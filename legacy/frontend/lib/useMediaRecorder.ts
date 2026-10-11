"use client";

import { useState, useRef, useCallback } from "react";

interface MediaRecorderState {
  isRecording: boolean;
  recordedBlob: Blob | null;
  recordedUrl: string | null;
  duration: number;
  error: string | null;
}

export function useMediaRecorder() {
  const [state, setState] = useState<MediaRecorderState>({
    isRecording: false,
    recordedBlob: null,
    recordedUrl: null,
    duration: 0,
    error: null,
  });

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startTimeRef = useRef<number>(0);
  const streamRef = useRef<MediaStream | null>(null);

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });

      streamRef.current = stream;

      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: "video/webm;codecs=vp8,opus",
      });

      chunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: "video/webm" });
        const url = URL.createObjectURL(blob);
        const duration = Math.floor((Date.now() - startTimeRef.current) / 1000);

        setState((prev) => ({
          ...prev,
          isRecording: false,
          recordedBlob: blob,
          recordedUrl: url,
          duration,
        }));
      };

      mediaRecorderRef.current = mediaRecorder;
      startTimeRef.current = Date.now();
      mediaRecorder.start(1000); // Collect data every second

      setState((prev) => ({ ...prev, isRecording: true, error: null }));
    } catch (error) {
      console.error("Failed to start recording:", error);
      setState((prev) => ({
        ...prev,
        error: "Failed to access camera/microphone. Please check permissions.",
      }));
    }
  }, []);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && state.isRecording) {
      mediaRecorderRef.current.stop();
      
      // Stop all tracks
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
    }
  }, [state.isRecording]);

  const clearRecording = useCallback(() => {
    if (state.recordedUrl) {
      URL.revokeObjectURL(state.recordedUrl);
    }
    setState({
      isRecording: false,
      recordedBlob: null,
      recordedUrl: null,
      duration: 0,
      error: null,
    });
    chunksRef.current = [];
  }, [state.recordedUrl]);

  return {
    ...state,
    startRecording,
    stopRecording,
    clearRecording,
  };
}
