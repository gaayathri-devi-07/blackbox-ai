import { initializeApp, getApps, getApp, FirebaseApp } from "firebase/app";
import { 
  getAuth, 
  Auth,
  browserLocalPersistence, 
  setPersistence, 
  GoogleAuthProvider, 
  GithubAuthProvider,
  signInWithPopup, 
  signOut as firebaseSignOut,
  RecaptchaVerifier,
  signInWithPhoneNumber,
  User
} from "firebase/auth";
import { getFirestore, Firestore, enableIndexedDbPersistence, initializeFirestore, CACHE_SIZE_UNLIMITED } from "firebase/firestore";

// ============================================
// FIREBASE CONFIGURATION
// ============================================
// Hardcoded config as fallback (Turbopack env loading issue workaround)
const getFirebaseConfig = () => {
  // Try to get from environment first
  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  
  // If env vars are loaded, use them
  if (apiKey) {
    return {
      apiKey,
      authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || '',
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || '',
      storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || '',
      messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || '',
      appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || '',
    };
  }
  
  // Fallback: Use hardcoded values (from your .env.local)
  console.warn('⚠️ Using hardcoded Firebase config (env vars not loaded)');
  return {
    apiKey: "AIzaSyCaw4i0EX_Cfp0Rn_H7zom06f4nKun6aPY",
    authDomain: "blackbox-f80df.firebaseapp.com",
    projectId: "blackbox-f80df",
    storageBucket: "blackbox-f80df.firebasestorage.app",
    messagingSenderId: "794133855558",
    appId: "1:794133855558:web:65373893373c7ea5ceb947",
  };
};

// ============================================
// FIREBASE APP INITIALIZATION (Singleton Pattern)
// ============================================
let firebaseApp: FirebaseApp | null = null;
let authInstance: Auth | null = null;
let dbInstance: Firestore | null = null;

// Initialize Firebase (only in browser)
const initializeFirebaseApp = () => {
  if (typeof window === 'undefined') {
    return;
  }

  if (firebaseApp) {
    return; // Already initialized
  }

  try {
    const firebaseConfig = getFirebaseConfig();
    
    // Validate config
    if (!firebaseConfig.apiKey || !firebaseConfig.projectId) {
      throw new Error('Firebase configuration is incomplete');
    }

    firebaseApp = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
    
    // Initialize Auth
    authInstance = getAuth(firebaseApp);
    
    // Initialize Firestore
    try {
      dbInstance = initializeFirestore(firebaseApp, {
        cacheSizeBytes: CACHE_SIZE_UNLIMITED,
      });
    } catch (e) {
      // Already initialized
      dbInstance = getFirestore(firebaseApp);
    }

    // Enable offline persistence
    if (dbInstance) {
      enableIndexedDbPersistence(dbInstance, { forceOwnership: false })
        .then(() => {
          console.log('✅ Firestore offline persistence enabled');
        })
        .catch((err) => {
          if (err.code === 'failed-precondition') {
            console.warn('⚠️ Multiple tabs open, persistence enabled in first tab only');
          } else if (err.code === 'unimplemented') {
            console.warn('⚠️ Browser does not support offline persistence');
          }
        });
    }

    // Set auth persistence
    if (authInstance) {
      setPersistence(authInstance, browserLocalPersistence).catch(() => {});
    }
      
    console.log('✅ Firebase initialized successfully');
  } catch (error: any) {
    console.error('🔥 Firebase initialization error:', error.message);
  }
};

// Initialize on module load if in browser
if (typeof window !== 'undefined') {
  initializeFirebaseApp();
}

// Getter functions that return the actual instances
export const getAuthInstance = (): Auth => {
  if (typeof window === 'undefined') {
    throw new Error('Auth can only be used in browser');
  }
  initializeFirebaseApp();
  if (!authInstance) {
    throw new Error('Firebase Auth not initialized');
  }
  return authInstance;
};

export const getDbInstance = (): Firestore => {
  if (typeof window === 'undefined') {
    throw new Error('Firestore can only be used in browser');
  }
  initializeFirebaseApp();
  if (!dbInstance) {
    throw new Error('Firestore not initialized');
  }
  return dbInstance;
};

// Export the actual instances (will be initialized on module load in browser)
export const auth = authInstance as Auth;
export const db = dbInstance as Firestore;

// ============================================
// AUTH PROVIDERS
// ============================================
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({
  prompt: 'select_account',
});

export const githubProvider = new GithubAuthProvider();

// ============================================
// AUTH FUNCTIONS WITH ROBUST ERROR HANDLING
// ============================================

export interface AuthResult {
  user: User | null;
  error: string | null;
}

export const signInWithGoogle = async (): Promise<AuthResult> => {
  if (typeof window === 'undefined') {
    return { user: null, error: 'Cannot sign in on server side' };
  }

  try {
    console.log('🔐 Attempting Google sign-in...');
    const auth = getAuthInstance();
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    
    const result = await signInWithPopup(auth, provider);
    console.log('✅ Google sign-in successful:', result.user.email);
    
    return { user: result.user, error: null };
  } catch (error: any) {
    console.error('❌ Firebase Auth Error (Google):', error);
    
    let errorMessage = 'Failed to sign in with Google';
    
    if (error.code === 'auth/popup-blocked') {
      errorMessage = 'Pop-up blocked. Please allow pop-ups for this site.';
    } else if (error.code === 'auth/popup-closed-by-user') {
      errorMessage = 'Sign-in cancelled. Please try again.';
    } else if (error.code === 'auth/network-request-failed') {
      errorMessage = 'Network error. Please check your internet connection.';
    } else if (error.code === 'auth/unauthorized-domain') {
      errorMessage = 'This domain is not authorized. Please add it in Firebase Console.';
    } else if (error.code === 'auth/internal-error') {
      errorMessage = 'Firebase internal error. Please enable Google Sign-In in Firebase Console.';
    } else if (error.message) {
      errorMessage = error.message;
    }
    
    return { user: null, error: errorMessage };
  }
};

export const signInWithGithub = async (): Promise<AuthResult> => {
  if (typeof window === 'undefined') {
    return { user: null, error: 'Cannot sign in on server side' };
  }

  try {
    console.log('🔐 Attempting GitHub sign-in...');
    const auth = getAuthInstance();
    const provider = new GithubAuthProvider();
    
    const result = await signInWithPopup(auth, provider);
    console.log('✅ GitHub sign-in successful:', result.user.email);
    
    return { user: result.user, error: null };
  } catch (error: any) {
    console.error('❌ Firebase Auth Error (GitHub):', error);
    
    let errorMessage = 'Failed to sign in with GitHub';
    
    if (error.code === 'auth/popup-blocked') {
      errorMessage = 'Pop-up blocked. Please allow pop-ups for this site.';
    } else if (error.code === 'auth/popup-closed-by-user') {
      errorMessage = 'Sign-in cancelled. Please try again.';
    } else if (error.code === 'auth/account-exists-with-different-credential') {
      errorMessage = 'An account already exists with this email using a different sign-in method.';
    } else if (error.message) {
      errorMessage = error.message;
    }
    
    return { user: null, error: errorMessage };
  }
};

export const setupRecaptcha = (containerId: string): RecaptchaVerifier | null => {
  if (typeof window === 'undefined') return null;
  
  try {
    const auth = getAuthInstance();
    return new RecaptchaVerifier(auth, containerId, {
      size: 'invisible',
      callback: () => {
        console.log('✅ reCAPTCHA solved');
      },
      'expired-callback': () => {
        console.warn('⚠️ reCAPTCHA expired, please try again');
      }
    });
  } catch (error) {
    console.error('❌ reCAPTCHA setup error:', error);
    return null;
  }
};

export const sendPhoneVerification = async (
  phoneNumber: string, 
  recaptchaVerifier: RecaptchaVerifier
): Promise<{ confirmationResult: any; error: string | null }> => {
  try {
    console.log('📱 Sending verification code to:', phoneNumber);
    const auth = getAuthInstance();
    const confirmationResult = await signInWithPhoneNumber(auth, phoneNumber, recaptchaVerifier);
    console.log('✅ Verification code sent');
    
    return { confirmationResult, error: null };
  } catch (error: any) {
    console.error('❌ Phone verification error:', error);
    
    let errorMessage = 'Failed to send verification code';
    if (error.code === 'auth/invalid-phone-number') {
      errorMessage = 'Invalid phone number format. Use international format (+1234567890)';
    } else if (error.message) {
      errorMessage = error.message;
    }
    
    return { confirmationResult: null, error: errorMessage };
  }
};

export const verifyPhoneCode = async (
  confirmationResult: any, 
  code: string
): Promise<AuthResult> => {
  try {
    console.log('🔐 Verifying code...');
    const result = await confirmationResult.confirm(code);
    console.log('✅ Phone verification successful');
    
    return { user: result.user, error: null };
  } catch (error: any) {
    console.error('❌ Code verification error:', error);
    
    let errorMessage = 'Invalid verification code';
    if (error.code === 'auth/invalid-verification-code') {
      errorMessage = 'Invalid code. Please check and try again.';
    } else if (error.code === 'auth/code-expired') {
      errorMessage = 'Code expired. Please request a new one.';
    } else if (error.message) {
      errorMessage = error.message;
    }
    
    return { user: null, error: errorMessage };
  }
};

export const signOut = async (): Promise<{ error: string | null }> => {
  try {
    console.log('👋 Signing out...');
    const auth = getAuthInstance();
    await firebaseSignOut(auth);
    console.log('✅ Sign out successful');
    
    return { error: null };
  } catch (error: any) {
    console.error('❌ Sign out error:', error);
    return { error: error.message || 'Failed to sign out' };
  }
};

