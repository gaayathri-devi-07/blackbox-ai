"use client";

import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import type { FaceLandmarker, PoseLandmarker } from "@mediapipe/tasks-vision";

/**
 * On-device delivery analysis with MediaPipe. Nothing leaves the browser.
 *
 * Every number is measured, not estimated:
 * - Eye contact = share of camera time the head faces the screen AND the eyes
 *   look at it (head yaw/pitch from the face transformation matrix, gaze from
 *   the eyeLook* blendshapes). The first ~2 s of steady frames calibrate the
 *   candidate's own "looking at the screen" head angle, since webcams sit at
 *   different heights. Blinks keep the previous state.
 * - Posture = share of the time shoulders are visible that the candidate sits
 *   upright: level shoulders, head not sinking toward the shoulders, and not
 *   hunched toward the screen — each relative to the candidate's own
 *   calibrated baseline, so camera distance doesn't matter.
 * Time is accumulated per processed frame (~7 per second), not per frame count.
 */

export type InterviewExpression = "smiling" | "serious";
export type PostureIssue = "uneven-shoulders" | "slouching" | "too-close" | null;

export interface InterviewAnalyzerSummary {
  /** Seconds the camera was analysed. */
  measuredSec: number;
  /** Seconds a face was visible. */
  faceSec: number;
  eyeContactSec: number;
  /** Seconds shoulders were visible. */
  poseSec: number;
  uprightSec: number;
  smileSec: number;
  /** 0–100: eye contact over all analysed time (looking away or leaving frame counts against). */
  eyeContactScore: number;
  /** 0–100: upright time over the time shoulders were visible. */
  postureScore: number;
  /** 0–100: share of analysed time the face was in frame. */
  facePresence: number;
  smilePercentage: number;
  /** Whether shoulders were visible long enough (≥ 10 s) to score posture. */
  postureMeasured: boolean;
}

export interface InterviewAnalyzerLive extends InterviewAnalyzerSummary {
  isReady: boolean;
  calibrated: boolean;
  faceVisible: boolean;
  isMakingEyeContact: boolean;
  expression: InterviewExpression;
  isSlouching: boolean;
  postureIssue: PostureIssue;
}

// Must match the installed @mediapipe/tasks-vision version.
const WASM_CDN = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.34/wasm";
const FACE_MODEL = "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task";
const POSE_MODEL = "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task";

const FRAME_INTERVAL_MS = 140;
const CALIBRATION_FRAMES = 14; // ~2 s

// Thresholds relative to the calibrated baseline.
const MAX_YAW_DEG = 16;
const MAX_PITCH_DEG = 14;
const GAZE_AWAY = 0.55; // eyeLook* blendshape score
const BLINK = 0.6;
const MAX_SHOULDER_TILT_DEG = 7;
const HEAD_DROP_RATIO = 0.78; // neck height vs. baseline
const TOO_CLOSE_RATIO = 1.3; // shoulder width vs. baseline

const pct = (part: number, total: number) => (total > 0 ? Math.max(0, Math.min(100, Math.round((part / total) * 100))) : 0);
const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length ? s[Math.floor(s.length / 2)] : 0;
};
const deg = (rad: number) => (rad * 180) / Math.PI;

/** Head yaw and pitch (degrees) from MediaPipe's column-major 4×4 transform. */
function headAngles(m: number[]): { yaw: number; pitch: number } {
  const r20 = m[2];
  const r21 = m[6];
  const r22 = m[10];
  return { yaw: deg(Math.asin(Math.max(-1, Math.min(1, -r20)))), pitch: deg(Math.atan2(r21, r22)) };
}

/**
 * MediaPipe's WASM runtime prints "INFO: Created TensorFlow Lite XNNPACK
 * delegate" through console.error, which dev tooling reports as an error.
 * Drop only those informational lines while the analyzer is running.
 */
function muteRuntimeInfoLogs(): () => void {
  const original = console.error;
  const filtered = (...args: unknown[]) => {
    if (typeof args[0] === "string" && /^INFO: /.test(args[0])) return;
    original.apply(console, args);
  };
  console.error = filtered;
  return () => {
    if (console.error === filtered) console.error = original;
  };
}

const EMPTY: InterviewAnalyzerLive = {
  isReady: false,
  calibrated: false,
  faceVisible: false,
  isMakingEyeContact: false,
  expression: "serious",
  isSlouching: false,
  postureIssue: null,
  measuredSec: 0,
  faceSec: 0,
  eyeContactSec: 0,
  poseSec: 0,
  uprightSec: 0,
  smileSec: 0,
  eyeContactScore: 0,
  postureScore: 0,
  facePresence: 0,
  smilePercentage: 0,
  postureMeasured: false,
};

export function useInterviewAnalyzer(videoRef: RefObject<HTMLVideoElement | null>) {
  const [live, setLive] = useState<InterviewAnalyzerLive>(EMPTY);

  const frameRef = useRef<number | null>(null);
  const runningRef = useRef(false);
  const lastRunRef = useRef(0);
  const faceRef = useRef<FaceLandmarker | null>(null);
  const poseRef = useRef<PoseLandmarker | null>(null);
  const stats = useRef({ measured: 0, face: 0, eye: 0, pose: 0, upright: 0, smile: 0 });
  const calib = useRef({
    yaw: [] as number[],
    pitch: [] as number[],
    neck: [] as number[],
    width: [] as number[],
    base: null as null | { yaw: number; pitch: number },
    poseBase: null as null | { neck: number; width: number },
  });
  const lastEye = useRef(false);

  const getSummary = useCallback((): InterviewAnalyzerSummary => {
    const s = stats.current;
    return {
      measuredSec: Math.round(s.measured),
      faceSec: Math.round(s.face),
      eyeContactSec: Math.round(s.eye),
      poseSec: Math.round(s.pose),
      uprightSec: Math.round(s.upright),
      smileSec: Math.round(s.smile),
      eyeContactScore: pct(s.eye, s.measured),
      postureScore: pct(s.upright, s.pose),
      facePresence: pct(s.face, s.measured),
      smilePercentage: pct(s.smile, s.face),
      postureMeasured: s.pose >= 10,
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const restoreLogs = muteRuntimeInfoLogs();

    const loop = () => {
      if (!runningRef.current || cancelled) return;
      frameRef.current = window.requestAnimationFrame(loop);
      const video = videoRef.current;
      if (!video || video.readyState < 2 || video.videoWidth === 0 || video.paused) return;

      const now = performance.now();
      const elapsed = now - lastRunRef.current;
      if (elapsed < FRAME_INTERVAL_MS) return;
      // Cap the credited time so a stalled tab doesn't count as one long frame.
      const dt = lastRunRef.current ? Math.min(elapsed, 500) / 1000 : FRAME_INTERVAL_MS / 1000;
      lastRunRef.current = now;

      const face = faceRef.current;
      const pose = poseRef.current;
      if (!face || !pose) return;

      const c = calib.current;
      let faceVisible = false;
      let eyeContact = false;
      let expression: InterviewExpression = "serious";
      let poseVisible = false;
      let postureIssue: PostureIssue = null;

      try {
        const result = face.detectForVideo(video, now);
        const matrix = result.facialTransformationMatrixes?.[0]?.data;
        const shapes = result.faceBlendshapes?.[0]?.categories ?? [];
        if (result.faceLandmarks?.length && matrix) {
          faceVisible = true;
          const score = (name: string) => shapes.find((x) => x.categoryName === name)?.score ?? 0;
          const { yaw, pitch } = headAngles(Array.from(matrix));
          const blinking = score("eyeBlinkLeft") > BLINK && score("eyeBlinkRight") > BLINK;
          const gazeAway =
            Math.max(score("eyeLookOutLeft"), score("eyeLookInLeft")) > GAZE_AWAY ||
            Math.max(score("eyeLookOutRight"), score("eyeLookInRight")) > GAZE_AWAY ||
            (score("eyeLookDownLeft") + score("eyeLookDownRight")) / 2 > GAZE_AWAY ||
            (score("eyeLookUpLeft") + score("eyeLookUpRight")) / 2 > GAZE_AWAY;

          if (!c.base) {
            // Calibrate on steady, forward-ish frames with eyes on screen.
            if (!blinking && !gazeAway && Math.abs(yaw) < 30 && Math.abs(pitch) < 30) {
              c.yaw.push(yaw);
              c.pitch.push(pitch);
              if (c.yaw.length >= CALIBRATION_FRAMES) c.base = { yaw: median(c.yaw), pitch: median(c.pitch) };
            }
            eyeContact = !gazeAway && Math.abs(yaw) < MAX_YAW_DEG && Math.abs(pitch) < 25;
          } else if (blinking) {
            eyeContact = lastEye.current;
          } else {
            eyeContact = !gazeAway && Math.abs(yaw - c.base.yaw) <= MAX_YAW_DEG && Math.abs(pitch - c.base.pitch) <= MAX_PITCH_DEG;
          }
          expression = score("mouthSmileLeft") + score("mouthSmileRight") > 0.6 ? "smiling" : "serious";
        }
      } catch {
        /* a dropped frame is not evidence either way */
      }

      try {
        const result = pose.detectForVideo(video, now);
        const lm = result.landmarks?.[0];
        const nose = lm?.[0];
        const ls = lm?.[11];
        const rs = lm?.[12];
        if (nose && ls && rs && (ls.visibility ?? 1) > 0.5 && (rs.visibility ?? 1) > 0.5) {
          poseVisible = true;
          const width = Math.hypot(ls.x - rs.x, ls.y - rs.y);
          const neck = ((ls.y + rs.y) / 2 - nose.y) / Math.max(width, 1e-3);
          const tilt = deg(Math.atan2(Math.abs(ls.y - rs.y), Math.abs(ls.x - rs.x)));
          if (!c.poseBase) {
            if (tilt < MAX_SHOULDER_TILT_DEG) {
              c.neck.push(neck);
              c.width.push(width);
              if (c.neck.length >= CALIBRATION_FRAMES) c.poseBase = { neck: median(c.neck), width: median(c.width) };
            }
          } else if (tilt > MAX_SHOULDER_TILT_DEG) postureIssue = "uneven-shoulders";
          else if (neck < c.poseBase.neck * HEAD_DROP_RATIO) postureIssue = "slouching";
          else if (width > c.poseBase.width * TOO_CLOSE_RATIO) postureIssue = "too-close";
        }
      } catch {
        /* ignore dropped frame */
      }

      const s = stats.current;
      s.measured += dt;
      if (faceVisible) s.face += dt;
      if (eyeContact) s.eye += dt;
      if (expression === "smiling") s.smile += dt;
      if (poseVisible) {
        s.pose += dt;
        if (!postureIssue) s.upright += dt;
      }
      lastEye.current = eyeContact;

      setLive({
        ...getSummary(),
        isReady: true,
        calibrated: Boolean(c.base),
        faceVisible,
        isMakingEyeContact: eyeContact,
        expression,
        isSlouching: postureIssue !== null,
        postureIssue,
      });
    };

    const boot = async () => {
      try {
        const tasksVision = await import("@mediapipe/tasks-vision");
        const vision = await tasksVision.FilesetResolver.forVisionTasks(WASM_CDN);
        if (cancelled) return;
        faceRef.current = await tasksVision.FaceLandmarker.createFromOptions(vision, {
          baseOptions: { modelAssetPath: FACE_MODEL },
          runningMode: "VIDEO",
          numFaces: 1,
          outputFaceBlendshapes: true,
          outputFacialTransformationMatrixes: true,
        });
        poseRef.current = await tasksVision.PoseLandmarker.createFromOptions(vision, {
          baseOptions: { modelAssetPath: POSE_MODEL },
          runningMode: "VIDEO",
          numPoses: 1,
        });
        if (cancelled) return;
        runningRef.current = true;
        setLive((prev) => ({ ...prev, isReady: true }));
        loop();
      } catch {
        setLive((prev) => ({ ...prev, isReady: false }));
      }
    };

    void boot();

    return () => {
      cancelled = true;
      runningRef.current = false;
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
      faceRef.current?.close();
      poseRef.current?.close();
      faceRef.current = null;
      poseRef.current = null;
      restoreLogs();
    };
  }, [videoRef, getSummary]);

  return { ...live, getSummary };
}
