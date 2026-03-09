"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { User, onAuthStateChanged, signInWithPopup, signOut as firebaseSignOut } from "firebase/auth";
import { doc, setDoc, getDoc } from "firebase/firestore";
import { auth, db, googleProvider } from "@/lib/firebase";
import type { UserProfile } from "@/lib/types";

interface AuthContextType {
  user: User | null;
  userProfile: UserProfile | null;
  loading: boolean;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
  getIdToken: () => Promise<string | null>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  userProfile: null,
  loading: true,
  signIn: async () => {},
  signOut: async () => {},
  getIdToken: async () => null,
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u) {
        // Create/fetch user profile in Firestore
        const ref = doc(db, "users", u.uid);
        const snap = await getDoc(ref);
        if (!snap.exists()) {
          const newProfile: UserProfile = {
            uid: u.uid,
            displayName: u.displayName || "Player",
            email: u.email || "",
            photoURL: u.photoURL || "",
            isAdmin: u.uid === process.env.NEXT_PUBLIC_ADMIN_UID,
            totalPoints: 0,
            joinedAt: new Date().toISOString(),
          };
          await setDoc(ref, newProfile);
          setUserProfile(newProfile);
        } else {
          setUserProfile(snap.data() as UserProfile);
        }
      } else {
        setUserProfile(null);
      }
      setLoading(false);
    });
    return unsub;
  }, []);

  const signIn = async () => {
    await signInWithPopup(auth, googleProvider);
  };

  const signOut = async () => {
    await firebaseSignOut(auth);
  };

  const getIdToken = async (): Promise<string | null> => {
    if (!user) return null;
    return user.getIdToken();
  };

  return (
    <AuthContext.Provider value={{ user, userProfile, loading, signIn, signOut, getIdToken }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
