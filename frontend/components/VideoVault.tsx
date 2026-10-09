"use client";

import { motion, AnimatePresence } from "framer-motion";
import { X, Play, Download } from "lucide-react";

interface VideoVaultProps {
  isOpen: boolean;
  onClose: () => void;
  recordings: Array<{
    sessionId: string;
    url: string;
    duration: number;
    type: string;
    date: Date;
  }>;
}

export default function VideoVault({ isOpen, onClose, recordings }: VideoVaultProps) {
  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const downloadVideo = (url: string, sessionId: string) => {
    const a = document.createElement('a');
    a.href = url;
    a.download = `blackbox-ai-session-${sessionId}.webm`;
    a.click();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            className="fixed inset-0 bg-black/90 backdrop-blur-sm z-[9998]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />

          <div className="fixed inset-0 z-[9999] flex items-center justify-center p-6">
            <motion.div
              className="relative w-full max-w-5xl bg-[#0A0A0F] border border-white/10 rounded-3xl p-8 max-h-[90vh] overflow-y-auto"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
            >
              <button
                onClick={onClose}
                className="absolute top-6 right-6 p-2 rounded-full hover:bg-white/5 transition-colors z-10"
              >
                <X className="w-6 h-6 text-white/60" />
              </button>

              <div className="mb-8">
                <h2 className="text-4xl font-black text-white mb-2">
                  📹 Video Vault
                </h2>
                <p className="text-white/60">
                  Review your past session recordings
                </p>
              </div>

              {recordings.length === 0 ? (
                <div className="text-center py-16">
                  <div className="text-6xl mb-4">🎥</div>
                  <p className="text-white/40 text-lg">
                    No recordings yet. Complete a session to see it here!
                  </p>
                </div>
              ) : (
                <div className="space-y-6">
                  {recordings.map((recording, idx) => (
                    <motion.div
                      key={recording.sessionId}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.1 }}
                      className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden"
                    >
                      <div className="p-6 flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <span className="text-2xl">
                              {recording.type === "interview" ? "💼" : "👥"}
                            </span>
                            <h3 className="text-xl font-bold text-white">
                              {recording.type === "interview" ? "Mock Interview" : "Group Discussion"}
                            </h3>
                          </div>
                          <div className="flex items-center gap-4 text-sm text-white/60">
                            <span>{new Date(recording.date).toLocaleDateString()}</span>
                            <span>Duration: {formatDuration(recording.duration)}</span>
                          </div>
                        </div>

                        <div className="flex items-center gap-3">
                          <button
                            onClick={() => {
                              const video = document.getElementById(`video-${recording.sessionId}`) as HTMLVideoElement;
                              if (video) {
                                if (video.paused) video.play();
                                else video.pause();
                              }
                            }}
                            className="px-6 py-3 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-semibold transition-all flex items-center gap-2"
                          >
                            <Play className="w-4 h-4" />
                            Play
                          </button>
                          <button
                            onClick={() => downloadVideo(recording.url, recording.sessionId)}
                            className="px-6 py-3 rounded-xl bg-white/10 hover:bg-white/20 text-white font-semibold transition-all flex items-center gap-2"
                          >
                            <Download className="w-4 h-4" />
                            Download
                          </button>
                        </div>
                      </div>

                      <div className="px-6 pb-6">
                        <video
                          id={`video-${recording.sessionId}`}
                          src={recording.url}
                          controls
                          className="w-full rounded-xl bg-black"
                        />
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}
