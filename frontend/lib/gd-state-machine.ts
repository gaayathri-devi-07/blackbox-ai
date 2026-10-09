// Group Discussion State Machine Types and Logic

export type GDState =
  | "WAITING_TO_START"
  | "MODERATOR_INTRO"
  | "WAITING_FOR_HANDS"
  | "SPEAKER_ACTIVE"
  | "INTERRUPT_REQUEST"
  | "SESSION_COMPLETE";

export type ParticipantRole = "moderator" | "ai" | "user";

export interface Participant {
  id: string;
  name: string;
  role: ParticipantRole;
  handRaised: boolean;
  isSpeaking: boolean;
  isNodding: boolean;
  avatar: string; // ai1, ai2, ai3, ai4, nod1, nod2, nod3, nod4, or user avatar
  contributionCount: number;
}

export interface GDMessage {
  id: string;
  participantId: string;
  participantName: string;
  message: string;
  timestamp: number;
  isInterruption?: boolean;
}

export interface GDStateContext {
  currentState: GDState;
  topic: string;
  participants: Participant[];
  activeSpeakerId: string | null;
  activeModerator: "mod1" | "mod2";
  messages: GDMessage[];
  handRaisedQueue: string[];
  sessionStartTime: number;
  sessionDuration: number; // in seconds
  userInterruptRequested: boolean;
}

// ============================================================================
// STATE TRANSITIONS
// ============================================================================

export function createInitialGDState(topic: string, userId: string): GDStateContext {
  return {
    currentState: "WAITING_TO_START",
    topic,
    participants: [
      {
        id: "mod1",
        name: "Dr. Sharma",
        role: "moderator",
        handRaised: false,
        isSpeaking: false,
        isNodding: false,
        avatar: "mod1",
        contributionCount: 0,
      },
      {
        id: "mod2",
        name: "Prof. Kumar",
        role: "moderator",
        handRaised: false,
        isSpeaking: false,
        isNodding: false,
        avatar: "mod2",
        contributionCount: 0,
      },
      {
        id: "ai1",
        name: "Priya",
        role: "ai",
        handRaised: false,
        isSpeaking: false,
        isNodding: false,
        avatar: "ai1",
        contributionCount: 0,
      },
      {
        id: "ai2",
        name: "Rahul",
        role: "ai",
        handRaised: false,
        isSpeaking: false,
        isNodding: false,
        avatar: "ai2",
        contributionCount: 0,
      },
      {
        id: "ai3",
        name: "Sneha",
        role: "ai",
        handRaised: false,
        isSpeaking: false,
        isNodding: false,
        avatar: "ai3",
        contributionCount: 0,
      },
      {
        id: "ai4",
        name: "Arjun",
        role: "ai",
        handRaised: false,
        isSpeaking: false,
        isNodding: false,
        avatar: "ai4",
        contributionCount: 0,
      },
      {
        id: userId,
        name: "You",
        role: "user",
        handRaised: false,
        isSpeaking: false,
        isNodding: false,
        avatar: "user",
        contributionCount: 0,
      },
    ],
    activeSpeakerId: null,
    activeModerator: "mod1",
    messages: [],
    handRaisedQueue: [],
    sessionStartTime: Date.now(),
    sessionDuration: 600, // 10 minutes
    userInterruptRequested: false,
  };
}

export function updateParticipantAvatar(context: GDStateContext): GDStateContext {
  return {
    ...context,
    participants: context.participants.map((p) => {
      if (p.role === "ai") {
        // Update AI avatar based on speaking state
        const baseAvatar = p.avatar.replace(/^(nod|ai)/, "");
        const number = baseAvatar.match(/\d+/)?.[0] || "1";
        
        if (p.isSpeaking) {
          return { ...p, avatar: `ai${number}`, isNodding: false };
        } else if (context.activeSpeakerId && context.activeSpeakerId !== p.id) {
          return { ...p, avatar: `nod${number}`, isNodding: true };
        } else {
          return { ...p, avatar: `ai${number}`, isNodding: false };
        }
      }
      return p;
    }),
  };
}

export function transitionToState(
  context: GDStateContext,
  newState: GDState
): GDStateContext {
  return updateParticipantAvatar({ ...context, currentState: newState });
}

export function setActiveSpeaker(
  context: GDStateContext,
  participantId: string
): GDStateContext {
  const updatedContext = {
    ...context,
    activeSpeakerId: participantId,
    currentState: "SPEAKER_ACTIVE" as GDState,
    participants: context.participants.map((p) => ({
      ...p,
      isSpeaking: p.id === participantId,
      handRaised: p.id === participantId ? false : p.handRaised,
    })),
    handRaisedQueue: context.handRaisedQueue.filter((id) => id !== participantId),
  };
  
  return updateParticipantAvatar(updatedContext);
}

export function raiseHand(context: GDStateContext, participantId: string): GDStateContext {
  if (context.handRaisedQueue.includes(participantId)) return context;

  return {
    ...context,
    participants: context.participants.map((p) =>
      p.id === participantId ? { ...p, handRaised: true } : p
    ),
    handRaisedQueue: [...context.handRaisedQueue, participantId],
  };
}

export function lowerHand(context: GDStateContext, participantId: string): GDStateContext {
  return {
    ...context,
    participants: context.participants.map((p) =>
      p.id === participantId ? { ...p, handRaised: false } : p
    ),
    handRaisedQueue: context.handRaisedQueue.filter((id) => id !== participantId),
  };
}

export function addMessage(
  context: GDStateContext,
  participantId: string,
  message: string,
  isInterruption = false
): GDStateContext {
  const participant = context.participants.find((p) => p.id === participantId);
  if (!participant) return context;

  const newMessage: GDMessage = {
    id: `msg-${Date.now()}-${Math.random()}`,
    participantId,
    participantName: participant.name,
    message,
    timestamp: Date.now(),
    isInterruption,
  };

  return {
    ...context,
    messages: [...context.messages, newMessage],
    participants: context.participants.map((p) =>
      p.id === participantId ? { ...p, contributionCount: p.contributionCount + 1 } : p
    ),
  };
}

export function selectNextSpeaker(context: GDStateContext): GDStateContext {
  // Moderator selects from handRaisedQueue
  if (context.handRaisedQueue.length === 0) {
    return transitionToState(context, "WAITING_FOR_HANDS");
  }

  const nextSpeakerId = context.handRaisedQueue[0];
  return setActiveSpeaker(context, nextSpeakerId);
}

export function switchModerator(context: GDStateContext): GDStateContext {
  return {
    ...context,
    activeModerator: context.activeModerator === "mod1" ? "mod2" : "mod1",
  };
}

// ============================================================================
// AI PARTICIPANT LOGIC
// ============================================================================

export function shouldAIRaiseHand(participant: Participant): boolean {
  // Probability-based logic
  if (participant.handRaised) return false;
  if (participant.isSpeaking) return false;
  
  // 30% chance to raise hand if they haven't spoken much
  const probability = participant.contributionCount < 2 ? 0.3 : 0.15;
  return Math.random() < probability;
}

export function processAIParticipants(context: GDStateContext): GDStateContext {
  if (context.currentState !== "WAITING_FOR_HANDS") return context;

  let updatedContext = context;
  const aiParticipants = context.participants.filter((p) => p.role === "ai");

  for (const ai of aiParticipants) {
    if (shouldAIRaiseHand(ai)) {
      updatedContext = raiseHand(updatedContext, ai.id);
    }
  }

  return updatedContext;
}
