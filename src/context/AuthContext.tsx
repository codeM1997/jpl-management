import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, signOut, type User } from 'firebase/auth';
import { doc, onSnapshot, updateDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';
import type { AppUser } from '../types';

interface AuthContextType {
  currentUser: User | null;
  userData: AppUser | null;
  loading: boolean;
  logout: () => Promise<void>;
  claimAdminRole: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  currentUser: null,
  userData: null,
  loading: true,
  logout: async () => {},
  claimAdminRole: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [userData, setUserData] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let unsubscribeDoc: (() => void) | null = null;

    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      if (user) {
        // Listen to live user profile document in Firestore
        unsubscribeDoc = onSnapshot(doc(db, 'users', user.uid), (docSnap) => {
        if (docSnap.exists()) {
          const uData = docSnap.data() as AppUser;
          setUserData(uData);
        } else {
          setUserData(null);
        }
        setLoading(false);
        }, (error) => {
          console.error("Firestore user sync error:", error);
          setLoading(false);
        });
      } else {
        if (unsubscribeDoc) {
          unsubscribeDoc();
          unsubscribeDoc = null;
        }
        setUserData(null);
        setLoading(false);
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeDoc) unsubscribeDoc();
    };
  }, []);

  const logout = async () => {
    await signOut(auth);
  };

  const claimAdminRole = async () => {
    if (!currentUser || !userData) return;
    const userDocRef = doc(db, 'users', currentUser.uid);
    await updateDoc(userDocRef, {
      role: 'admin',
      tier: 1,
    });
  };

  return (
    <AuthContext.Provider value={{ currentUser, userData, loading, logout, claimAdminRole }}>
      {children}
    </AuthContext.Provider>
  );
};
