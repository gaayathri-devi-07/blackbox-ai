"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { onIdTokenChanged, type User as FirebaseUser } from "firebase/auth";
import { api, errorMessage, setTokenGetter } from "@/lib/api-client";
import { getFirebaseAuth, firebaseConfigured, signOutOfFirebase } from "@/lib/firebase";
import type { Profile } from "@/lib/db";

export type AuthStatus = "loading" | "signed-out" | "signed-in";

export interface SessionUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  isDemo: boolean;
}

interface AuthContextValue {
  status: AuthStatus;
  user: SessionUser | null;
  profile: Profile | null;
  profileError: string | null;
  demoAvailable: boolean;
  refreshProfile: () => Promise<void>;
  setProfile: (profile: Profile) => void;
  signInDemo: () => void;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const DEMO_KEY = "bbx-demo-session";
const DEMO_UID = "demo-candidate";
const demoAvailable = process.env.NEXT_PUBLIC_DEV_AUTH_BYPASS === "true";

function readDemoSession(): boolean {
  try {
    return demoAvailable && window.localStorage.getItem(DEMO_KEY) === "1";
  } catch {
    return false;
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [user, setUser] = useState<SessionUser | null>(null);
  const [profile, setProfileState] = useState<Profile | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);
  const firebaseUserRef = useRef<FirebaseUser | null>(null);
  const demoRef = useRef(false);

  // Every API call asks for a fresh token through this getter.
  useEffect(() => {
    setTokenGetter(async (forceRefresh) => {
      if (demoRef.current) return `dev:${DEMO_UID}`;
      const fbUser = firebaseUserRef.current;
      return fbUser ? fbUser.getIdToken(forceRefresh) : null;
    });
  }, []);

  const loadProfile = useCallback(async () => {
    setProfileError(null);
    try {
      const { profile } = await api<{ profile: Profile }>("/api/me", { timeoutMs: 15_000 });
      setProfileState(profile);
    } catch (error) {
      setProfileError(errorMessage(error));
    }
  }, []);

  const enterDemo = useCallback(() => {
    demoRef.current = true;
    setUser({ uid: DEMO_UID, email: "demo@local", displayName: "Demo Candidate", photoURL: null, isDemo: true });
    setStatus("signed-in");
    void loadProfile();
  }, [loadProfile]);

  useEffect(() => {
    if (readDemoSession()) {
      // localStorage is only readable after hydration, so this must happen in an effect.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      enterDemo();
      return;
    }
    const auth = getFirebaseAuth();
    if (!auth) {
      setStatus("signed-out");
      return;
    }
    return onIdTokenChanged(auth, (fbUser) => {
      const previousUid = firebaseUserRef.current?.uid;
      firebaseUserRef.current = fbUser;
      if (!fbUser) {
        setUser(null);
        setProfileState(null);
        setStatus("signed-out");
        return;
      }
      setUser({
        uid: fbUser.uid,
        email: fbUser.email,
        displayName: fbUser.displayName,
        photoURL: fbUser.photoURL,
        isDemo: false,
      });
      setStatus("signed-in");
      // Token refreshes fire this listener too; only reload on a new identity.
      if (previousUid !== fbUser.uid) void loadProfile();
    });
  }, [enterDemo, loadProfile]);

  const signInDemo = useCallback(() => {
    if (!demoAvailable) return;
    try {
      window.localStorage.setItem(DEMO_KEY, "1");
    } catch {
      /* storage unavailable: session lasts for this tab only */
    }
    enterDemo();
  }, [enterDemo]);

  const signOut = useCallback(async () => {
    if (demoRef.current) {
      demoRef.current = false;
      try {
        window.localStorage.removeItem(DEMO_KEY);
      } catch {
        /* ignore */
      }
    } else {
      await signOutOfFirebase();
    }
    firebaseUserRef.current = null;
    setUser(null);
    setProfileState(null);
    setStatus("signed-out");
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      user,
      profile,
      profileError,
      demoAvailable,
      refreshProfile: loadProfile,
      setProfile: setProfileState,
      signInDemo,
      signOut,
    }),
    [status, user, profile, profileError, loadProfile, signInDemo, signOut]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>.");
  return ctx;
}

export { firebaseConfigured };
