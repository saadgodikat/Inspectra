import React, { createContext, useContext, useEffect, useState } from 'react';
import { authApi } from '../api/client';
import type { User, UserRole } from '../types';

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  switchRole: (role: UserRole) => Promise<void>;
  hasRole: (roles: UserRole | UserRole[]) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(() => {
    const saved = localStorage.getItem('user');
    return saved ? JSON.parse(saved) : null;
  });
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('access_token'));
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const applyAuth = (res: { user: User; access_token: string; refresh_token: string }) => {
    setToken(res.access_token);
    setUser(res.user);
    localStorage.setItem('access_token', res.access_token);
    localStorage.setItem('refresh_token', res.refresh_token);
    localStorage.setItem('user', JSON.stringify(res.user));
  };

  useEffect(() => {
    const init = async () => {
      const storedToken = localStorage.getItem('access_token');
      if (storedToken) {
        try {
          const res = await authApi.getMe();
          setUser(res.user);
          localStorage.setItem('user', JSON.stringify(res.user));
        } catch {
          // Token invalid — auto-login as default inspector
          try {
            const res = await authApi.switchRole('inspector');
            applyAuth(res);
          } catch {
            setUser(null);
            setToken(null);
          }
        }
      } else {
        // No token — auto-login as inspector
        try {
          const res = await authApi.switchRole('inspector');
          applyAuth(res);
        } catch {
          setUser(null);
          setToken(null);
        }
      }
      setIsLoading(false);
    };
    init();
  }, []);

  const switchRole = async (role: UserRole) => {
    const res = await authApi.switchRole(role);
    applyAuth(res);
  };

  const hasRole = (roles: UserRole | UserRole[]): boolean => {
    if (!user) return false;
    const allowed = Array.isArray(roles) ? roles : [roles];
    return allowed.includes(user.role);
  };

  return (
    <AuthContext.Provider value={{ user, token, isLoading, switchRole, hasRole }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
