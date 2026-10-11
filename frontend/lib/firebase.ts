"use client";

import { getApp, getApps, initializeApp, type FirebaseApp, type FirebaseOptions } from "firebase/app";
import {
  browserLocalPersistence,
  getAuth,
  GithubAuthProvider,
  GoogleAuthProvider,
  RecaptchaVerifier,
  setPersistence,
  signInWithPhoneNumber,
  signInWithPopup,
  signInWithRedirect,
  signOut as firebaseSignOut,
  type AuthProvider,
  type Auth,
  type ConfirmationResult,
} from "firebase/auth";

/**
 * Firebase is used for authentication only — all application data lives in
 * PostgreSQL. Configuration comes exclusively from NEXT_PUBLIC_FIREBASE_* env vars.
 */
const config: FirebaseOptions = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

export function firebaseConfigured(): boolean {
  return Boolean(config.apiKey && config.authDomain && config.projectId && config.appId);
}

let authInstance: Auth | null = null;

export function getFirebaseAuth(): Auth | null {
  if (typeof window === "undefined" || !firebaseConfigured()) return null;
  if (authInstance) return authInstance;
  const app: FirebaseApp = getApps().length ? getApp() : initializeApp(config);
  authInstance = getAuth(app);
  void setPersistence(authInstance, browserLocalPersistence).catch(() => undefined);
  return authInstance;
}

const FRIENDLY_ERRORS: Record<string, string> = {
  "auth/popup-blocked": "Your browser blocked the sign-in window. Allow pop-ups for this site and try again.",
  "auth/popup-closed-by-user": "The sign-in window was closed before completing.",
  "auth/cancelled-popup-request": "Another sign-in window is already open.",
  "auth/network-request-failed": "Network error. Check your connection and try again.",
  "auth/unauthorized-domain": "This domain isn't authorized for sign-in. Add it under Authentication → Settings in Firebase.",
  "auth/account-exists-with-different-credential": "An account already exists with this email using a different sign-in method.",
  "auth/invalid-phone-number": "Enter the number in international format, for example +14155550123.",
  "auth/invalid-verification-code": "That code is incorrect. Check it and try again.",
  "auth/code-expired": "That code has expired. Request a new one.",
  "auth/too-many-requests": "Too many attempts. Please wait a few minutes and try again.",
  "auth/operation-not-allowed": "This sign-in method isn't enabled. Turn it on in Firebase → Authentication → Sign-in method.",
  "auth/configuration-not-found": "Sign-in isn't set up for this Firebase project yet. Enable Google or GitHub under Authentication → Sign-in method.",
  "auth/invalid-api-key": "The Firebase API key is invalid. Check NEXT_PUBLIC_FIREBASE_API_KEY in .env.local.",
  "auth/internal-error": "Sign-in hit an internal error. Try again, or use another sign-in option.",
};

export function authErrorMessage(error: unknown): string {
  const code = (error as { code?: string })?.code ?? "";
  return FRIENDLY_ERRORS[code] ?? "Sign-in failed. Please try again.";
}

function requireAuth(): Auth {
  const auth = getFirebaseAuth();
  if (!auth) throw Object.assign(new Error("Authentication is not configured."), { code: "auth/not-configured" });
  return auth;
}

/** Popup first; if the browser blocks pop-ups, fall back to a full-page redirect. */
async function signInWith(provider: AuthProvider): Promise<void> {
  const auth = requireAuth();
  try {
    await signInWithPopup(auth, provider);
  } catch (error) {
    const code = (error as { code?: string }).code;
    if (code === "auth/popup-blocked" || code === "auth/operation-not-supported-in-this-environment") {
      await signInWithRedirect(auth, provider);
      return;
    }
    throw error;
  }
}

export async function signInWithGoogle(): Promise<void> {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: "select_account" });
  await signInWith(provider);
}

export async function signInWithGithub(): Promise<void> {
  const provider = new GithubAuthProvider();
  provider.addScope("read:user");
  provider.addScope("user:email");
  await signInWith(provider);
}

let recaptcha: RecaptchaVerifier | null = null;

export async function sendPhoneCode(phoneNumber: string, containerId: string): Promise<ConfirmationResult> {
  const auth = requireAuth();
  recaptcha?.clear();
  recaptcha = new RecaptchaVerifier(auth, containerId, { size: "invisible" });
  return signInWithPhoneNumber(auth, phoneNumber, recaptcha);
}

export async function signOutOfFirebase(): Promise<void> {
  const auth = getFirebaseAuth();
  if (auth) await firebaseSignOut(auth);
}
