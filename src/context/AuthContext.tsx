import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { User, ImpersonationState } from '../types';
import { api } from '../services/api';
import { loginWithEntraRedirect, handleMsalRedirect, logoutEntra } from '../services/msal';

interface AuthContextType {
  user: User | null;
  impersonation: ImpersonationState | null;
  loading: boolean;
  loginWithEntra: () => Promise<void>;
  verifyParentCode: (email: string, code: string) => Promise<void>;
  logout: () => Promise<void>;
  exitImpersonation: () => Promise<void>;
  refreshUser: () => Promise<void>;
  updateUserPicture: (dataUrl: string) => Promise<void>;
  devLoginAs: (user: Partial<User>) => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  impersonation: null,
  loading: true,
  loginWithEntra: async () => {},
  verifyParentCode: async () => {},
  logout: async () => {},
  exitImpersonation: async () => {},
  refreshUser: async () => {},
  updateUserPicture: async () => {},
  devLoginAs: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [impersonation, setImpersonation] = useState<ImpersonationState | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  const refreshUser = useCallback(async () => {
    try {
      const data = await api.get<{ user: User; impersonation: ImpersonationState | null }>('/api/auth/users/me');
      if (data && data.user) {
        setUser(data.user);
        setImpersonation(data.impersonation || null);
      } else {
        setUser(null);
        setImpersonation(null);
      }
    } catch {
      setUser(null);
      setImpersonation(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const initAuth = async () => {
      try {
        const idToken = await handleMsalRedirect();
        if (idToken) {
          // Sync with backend using the Entra ID token
          await fetch('/api/auth/users/sync', {
            method: 'POST',
            headers: { Authorization: `Bearer ${idToken}` },
          });
        }
      } catch (err) {
        console.error('[Auth] Error handling MSAL redirect:', err);
      }
      await refreshUser();
    };

    initAuth();
  }, [refreshUser]);

  const loginWithEntra = async () => {
    await loginWithEntraRedirect();
  };

  const verifyParentCode = async (email: string, code: string) => {
    const res = await api.post<{ authenticated: boolean; user: User }>('/api/auth/parent/verify-code', { email, code });
    if (res.authenticated) {
      await refreshUser();
    }
  };

  const logout = async () => {
    if (impersonation?.active) {
      // Impersonating users cannot sign out per Section 3.1 & 8
      return;
    }

    if (user?.authType === 'Entra') {
      try {
        await api.post('/api/auth/logout');
      } catch {
        // ignore
      }
      await logoutEntra();
    } else {
      await api.post('/api/auth/logout');
      setUser(null);
      setImpersonation(null);
      window.location.href = '/';
    }
  };

  const exitImpersonation = async () => {
    await api.post('/api/admin/impersonation/stop');
    setImpersonation(null);
    await refreshUser();
    window.location.href = '/portal/admin';
  };

  const updateUserPicture = async (dataUrl: string) => {
    const res = await api.post<{ profilePicture: string }>('/api/auth/users/me/picture', { image: dataUrl });
    if (user) {
      setUser({ ...user, profilePicture: res.profilePicture });
    }
  };

  const devLoginAs = async (mockUser: Partial<User>) => {
    // Quick login switch for testing roles in development
    const payload = {
      email: mockUser.email || 'admin@jess.sch.ae',
      name: mockUser.displayName || 'Dev Admin',
      department: mockUser.userType === 'Student' ? 'Student' : 'Staff',
    };
    const mockToken = `mock.${btoa(JSON.stringify(payload))}.sig`;
    await fetch('/api/auth/users/sync', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${mockToken}`,
        'Content-Type': 'application/json',
      },
    });
    await refreshUser();
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        impersonation,
        loading,
        loginWithEntra,
        verifyParentCode,
        logout,
        exitImpersonation,
        refreshUser,
        updateUserPicture,
        devLoginAs,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
