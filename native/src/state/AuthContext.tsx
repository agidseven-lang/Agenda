import React, {createContext, useContext, useEffect, useState, useCallback} from 'react';
import {AppUser, getUser} from '../services/firestore';
import {getSessionUid} from '../services/session';
import {logout as doLogout} from '../services/auth';

type AuthState = {
  user: AppUser | null;
  loading: boolean;
  setUser: (u: AppUser | null) => void;
  signOut: () => Promise<void>;
  reminderMinutes: number;
};

const Ctx = createContext<AuthState>({
  user: null,
  loading: true,
  setUser: () => {},
  signOut: async () => {},
  reminderMinutes: 60,
});

export const AuthProvider: React.FC<{children: React.ReactNode}> = ({children}) => {
  const [user, setUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const uid = await getSessionUid();
      if (uid) {
        try {
          const u = await getUser(uid);
          if (u && u.status !== 'removido' && u.status !== 'excluido') setUser(u);
        } catch {}
      }
      setLoading(false);
    })();
  }, []);

  const signOut = useCallback(async () => {
    await doLogout();
    setUser(null);
  }, []);

  const reminderMinutes = user && user.reminderMinutes && user.reminderMinutes > 0 ? user.reminderMinutes : 60;

  return (
    <Ctx.Provider value={{user, loading, setUser, signOut, reminderMinutes}}>
      {children}
    </Ctx.Provider>
  );
};

export const useAuth = () => useContext(Ctx);
