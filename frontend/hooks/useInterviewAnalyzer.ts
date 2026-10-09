"use client";

import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import type { FaceLandmarker, PoseLandmarker } from "@mediapipe/tasks-vision";

export type InterviewExpression = "smiling" | "serious";

export interface InterviewAnalyzerSummary {
  totalFrames: number;
  eyeContactFrames: number;
  smileFrames: number;
  slouchFrames: number;
  eyeContactScore: number;
  postureScore: number;
  smilePercentage: number;
}

export interface InterviewAnalyzerLive extends InterviewAnalyzerSummary {
  isReady: boolean;
  isMakingEyeContact: boolean;
  expression: InterviewExpression;
  isSlouching: boolean;
}

const WASM_CDN = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm";
const FACE_MODEL = "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task";
const POSE_MODEL = "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task";

const LEFT_IRIS = [468, 469, 470, 471, 472];
const RIGHT_IRIS = [473, 474, 475, 476, 477];
const LEFT_EYE_BOX = [33, 133, 159, 145];
const RIGHT_EYE_BOX = [362, 263, 386, 374];

function clampScore(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function ratio(part: number, total: number) {
  if (!total) return 0;
  return (part / total) * 100;
}

function averagePoint(landmarks: { x: number; y: number }[], ids: number[]) {
  const valid = ids.map((id) => landmarks[id]).filter(Boolean);
  if (!valid.length) return null;
  return {
    x: valid.reduce((sum, p) => sum + p.x, 0) / valid.length,
    y: valid.reduce((sum, p) => sum + p.y, 0) / valid.length,
  };
}

function eyeContactFromIris(landmarks: { x: number; y: number }[]) {
  const irisLeft = averagePoint(landmarks, LEFT_IRIS);
  const irisRight = averagePoint(landmarks, RIGHT_IRIS);
  const boxLeft = LEFT_EYE_BOX.map((id) => landmarks[id]).filter(Boolean);
  const boxRight = RIGHT_EYE_BOX.map((id) => landmarks[id]).filter(Boolean);

  if (!irisLeft || !irisRight || boxLeft.length < 4 || boxRight.length < 4) return false;

  const centeredInBox = (iris: { x: number; y: number }, box: { x: number; y: number }[]) => {
    const minX = Math.min(...box.map((p) => p.x));
    const maxX = Math.max(...box.map((p) => p.x));
    const minY = Math.min(...box.map((p) => p.y));
    const maxY = Math.max(...box.map((p) => p.y));
    const width = Math.max(maxX - minX, 0.0001);
    const height = Math.max(maxY - minY, 0.0001);
    const xNorm = (iris.x - minX) / width;
    const yNorm = (iris.y - minY) / height;
    return xNorm > 0.25 && xNorm < 0.75 && yNorm > 0.2 && yNorm < 0.8;
  };

  return centeredInBox(irisLeft, boxLeft) && centeredInBox(irisRight, boxRight);
}

export function useInterviewAnalyzer(videoRef: RefObject<HTMLVideoElement | null>) {
  const [live, setLive] = useState<InterviewAnalyzerLive>({
    isReady: false,
    isMakingEyeContact: false,
    expression: "serious",
    isSlouching: false,
    totalFrames: 0,
    eyeContactFrames: 0,
    smileFrames: 0,
    slouchFrames: 0,
    eyeContactScore: 0,
    postureScore: 0,
    smilePercentage: 0,
  });

  const frameRef = useRef<number | null>(null);
  const runningRef = useRef(false);
  const lastRunRef = useRef(0);
  const faceRef = useRef<FaceLandmarker | null>(null);
  const poseRef = useRef<PoseLandmarker | null>(null);
  const statsRef = useRef({
    totalFrames: 0,
    eyeContactFrames: 0,
    smileFrames: 0,
    slouchFrames: 0,
  });

  const getSummary = useCallback((): InterviewAnalyzerSummary => {
    const stats = statsRef.current;
    const eyeContactScore = clampScore(ratio(stats.eyeContactFrames, stats.totalFrames));
    const smilePercentage = clampScore(ratio(stats.smileFrames, stats.totalFrames));
    const slouchPercentage = clampScore(ratio(stats.slouchFrames, stats.totalFrames));
    const postureScore = clampScore(100 - slouchPercentage);

    return {
      ...stats,
      eyeContactScore,
      postureScore,
      smilePercentage,
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    const loop = () => {
      if (!runningRef.current || cancelled) return;
      frameRef.current = window.requestAnimationFrame(loop);
      const video = videoRef.current;
      if (!video || video.readyState < 2 || video.videoWidth === 0 || video.videoHeight === 0) return;

      const now = performance.now();
      if (now - lastRunRef.current < 150) return;
      lastRunRef.current = now;

      const faceLandmarker = faceRef.current;
      const poseLandmarker = poseRef.current;
      if (!faceLandmarker || !poseLandmarker) return;

      let isMakingEyeContact = false;
      let expression: InterviewExpression = "serious";
      let isSlouching = false;

      try {
        const faceResult = faceLandmarker.detectForVideo(video, now);
        if (faceResult.faceLandmarks?.length) {
          const landmarks = faceResult.faceLandmarks[0];
          isMakingEyeContact = eyeContactFromIris(landmarks);

          const blendshapes = faceResult.faceBlendshapes?.[0]?.categories ?? [];
          const smileLeft = blendshapes.find((c) => c.categoryName === "mouthSmileLeft")?.score ?? 0;
          const smileRight = blendshapes.find((c) => c.categoryName === "mouthSmileRight")?.score ?? 0;
          expression = smileLeft + smileRight > 0.3 ? "smiling" : "serious";
        }
      } catch (err) {
        console.warn("Face detection error:", err);
      }

      try {
        const poseResult = poseLandmarker.detectForVideo(video, now);
        if (poseResult.landmarks?.length) {
          const lm = poseResult.landmarks[0];
          const nose = lm[0];
          const leftShoulder = lm[11];
          const rightShoulder = lm[12];
          if (nose && leftShoulder && rightShoulder) {
            const shoulderY = (leftShoulder.y + rightShoulder.y) / 2;
            const verticalGap = shoulderY - nose.y;
            const shoulderTilt = Math.abs(leftShoulder.y - rightShoulder.y);
            isSlouching = verticalGap < 0.13 || shoulderTilt > 0.08;
          }
        }
      } catch (err) {
        console.warn("Pose detection error:", err);
      }

      statsRef.current.totalFrames += 1;
      if (isMakingEyeContact) statsRef.current.eyeContactFrames += 1;
      if (expression === "smiling") statsRef.current.smileFrames += 1;
      if (isSlouching) statsRef.current.slouchFrames += 1;

      const summary = getSummary();
      setLive({
        ...summary,
        isReady: true,
        isMakingEyeContact,
        expression,
        isSlouching,
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
    };
  }, [videoRef, getSummary]);

  return { ...live, getSummary };
}

