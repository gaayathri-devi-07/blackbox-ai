"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Hand, Mic, MicOff, Volume2 } from "lucide-react";
import {
  GDStateContext,
  createInitialGDState,
  raiseHand,
  lowerHand,
  setActiveSpeaker,
  selectNextSpeaker,
  addMessage,
  processAIParticipants,
  transitionToState,
} from "@/lib/gd-state-machine";

interface GDSimulatorProps {
  userId: string;
  topic: string;
  onComplete: (sessionData: any) => void;
}

export default function GDSimulator({ userId, topic, onComplete }: GDSimulatorProps) {
  const [state, setState] = useState<GDStateContext>(() => createInitialGDState(topic, userId));
  const [userInput, setUserInput] = useState("");
  const [isUserMuted, setIsUserMuted] = useState(false);

  // Auto-process AI participants
  useEffect(() => {
    if (state.currentState === "WAITING_FOR_HANDS") {
      const timer = setTimeout(() => {
        setState((prev) => processAIParticipants(prev));
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [state.currentState]);

  // Auto-select next speaker after 10 seconds
  useEffect(() => {
    if (state.currentState === "SPEAKER_ACTIVE" && state.activeSpeakerId) {
      const timer = setTimeout(() => {
        setState((prev) => selectNextSpeaker(prev));
      }, 10000);
      return () => clearTimeout(timer);
    }
  }, [state.currentState, state.activeSpeakerId]);

  const handleUserRaiseHand = () => {
    const userParticipant = state.participants.find((p) => p.id === userId);
    if (!userParticipant) return;

    if (userParticipant.handRaised) {
      setState((prev) => lowerHand(prev, userId));
    } else {
      setState((prev) => raiseHand(prev, userId));
    }
  };

  const handleUserSpeak = () => {
    if (!userInput.trim()) return;
    
    setState((prev) => {
      const updated = addMessage(prev, userId, userInput);
      return selectNextSpeaker(updated);
    });
    
    setUserInput("");
  };

  const userParticipant = state.participants.find((p) => p.id === userId);

  return (
    <div className="min-h-screen bg-[#0A0A0F] text-white p-6">
      {/* Top Bar */}
      <div className="max-w-7xl mx-auto mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold mb-1">Group Discussion</h1>
          <p className="text-white/60 text-sm">Topic: {state.topic}</p>
        </div>
        <div className="text-white/80 text-sm">
          Active Speaker: {state.activeSpeakerId
            ? state.participants.find((p) => p.id === state.activeSpeakerId)?.name
            : "None"}
        </div>
      </div>

      {/* 7-Card Grid */}
      <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4 mb-6">
        {state.participants.map((participant) => {
          const isActive = state.activeSpeakerId === participant.id;
          
          return (
            <motion.div
              key={participant.id}
              className={`relative p-6 rounded-2xl border-2 transition-all ${
                isActive
                  ? "border-purple-500 shadow-lg shadow-purple-500/30 bg-purple-500/10"
                  : "border-white/10 bg-white/5"
              }`}
              animate={isActive ? { scale: 1.05 } : { scale: 1 }}
            >
              {/* Avatar */}
              <div className="w-20 h-20 mx-auto mb-3 rounded-full bg-gradient-to-br from-purple-600 to-blue-600 flex items-center justify-center text-2xl font-bold">
                {participant.avatar.includes("nod") ? "😌" : participant.role === "user" ? "👤" : "🤖"}
              </div>

              {/* Name */}
              <h3 className="text-center font-semibold mb-1">{participant.name}</h3>
              <p className="text-center text-xs text-white/40 mb-3">
                {participant.role === "moderator" ? "Moderator" : participant.role === "user" ? "You" : "Participant"}
              </p>

              {/* Status */}
              {participant.handRaised && (
                <div className="absolute top-2 right-2 text-yellow-400">
                  <Hand className="w-5 h-5 animate-pulse" />
                </div>
              )}

              {isActive && (
                <div className="flex items-center justify-center gap-1 text-purple-400 text-xs">
                  <Volume2 className="w-3 h-3 animate-pulse" />
                  Speaking...
                </div>
              )}

              <div className="text-center text-xs text-white/30 mt-2">
                {participant.contributionCount} contributions
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Live Transcript */}
      <div className="max-w-7xl mx-auto">
        <div className="absolute bottom-0 left-0 right-0 bg-black/80 backdrop-blur-lg border-t border-white/10 p-4">
          <div className="max-w-4xl mx-auto">
            <h3 className="text-sm font-semibold text-white/80 mb-2">Live Transcript</h3>
            <div className="h-32 overflow-y-auto space-y-2">
              {state.messages.slice(-5).map((msg) => (
                <div key={msg.id} className="text-sm">
                  <span className="text-purple-400 font-medium">{msg.participantName}:</span>{" "}
                  <span className="text-white/80">{msg.message}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* User Controls */}
      <div className="fixed bottom-24 left-1/2 transform -translate-x-1/2 flex items-center gap-4">
        <button
          onClick={handleUserRaiseHand}
          className={`p-4 rounded-full transition-all ${
            userParticipant?.handRaised
              ? "bg-yellow-500 text-black"
              : "bg-white/10 text-white hover:bg-white/20"
          }`}
        >
          <Hand className="w-6 h-6" />
        </button>

        <button
          onClick={() => setIsUserMuted(!isUserMuted)}
          className={`p-4 rounded-full ${
            isUserMuted ? "bg-red-500" : "bg-white/10 hover:bg-white/20"
          }`}
        >
          {isUserMuted ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
        </button>

        {state.activeSpeakerId === userId && (
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={userInput}
              onChange={(e) => setUserInput(e.target.value)}
              onKeyPress={(e) => e.key === "Enter" && handleUserSpeak()}
              placeholder="Type your response..."
              className="px-4 py-2 rounded-lg bg-white/10 border border-white/20 text-white placeholder:text-white/40 focus:outline-none focus:border-purple-500"
            />
            <button
              onClick={handleUserSpeak}
              className="px-6 py-2 rounded-lg bg-purple-600 hover:bg-purple-700 font-semibold"
            >
              Send
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
