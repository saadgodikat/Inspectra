import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { AlertCircle, Lock, Mail } from 'lucide-react';

export const LoginPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const from = location.state?.from?.pathname || '/';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      await login(email, password);
      navigate(from, { replace: true });
    } catch (err: any) {
      const msg = err.response?.data?.error || 'Authentication failed. Please verify credentials.';
      setError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDemoLogin = async (demoEmail: string, demoPass: string) => {
    setEmail(demoEmail);
    setPassword(demoPass);
    setError(null);
    setIsSubmitting(true);
    try {
      await login(demoEmail, demoPass);
      navigate(from, { replace: true });
    } catch (err: any) {
      const msg = err.response?.data?.error || 'Demo login failed.';
      setError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-on-surface flex flex-col justify-center py-12 sm:px-6 lg:px-8 relative overflow-hidden select-none">
      {/* Background industrial accents */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-primary-container/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-tertiary-container/10 rounded-full blur-3xl pointer-events-none" />

      <div className="sm:mx-auto sm:w-full sm:max-w-md relative z-10 text-center">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-xl bg-gradient-to-tr from-amber-600 via-amber-500 to-amber-300 shadow-xl shadow-amber-500/25 text-black font-bold text-2xl mb-3">
          <span className="material-symbols-outlined text-[28px] text-black">analytics</span>
        </div>
        <h2 className="font-headline text-headline-xl font-bold tracking-tight text-on-surface uppercase">
          INSPECTRA
        </h2>
        <p className="font-mono text-body-sm text-outline mt-1 tracking-wider uppercase">
          Quality Intelligence &amp; Telemetry Console
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md relative z-10 px-4">
        <div className="bg-surface-container-low py-8 px-6 shadow-2xl rounded-2xl sm:px-10 border border-surface-container-high">
          {error && (
            <div className="mb-5 p-3 rounded-lg bg-error-container/30 border border-error/30 text-error flex items-start gap-2.5 text-body-sm">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <div className="font-mono">{error}</div>
            </div>
          )}

          <form className="space-y-4" onSubmit={handleSubmit}>
            <div>
              <label className="block text-label-sm font-mono uppercase text-outline mb-1">
                Operator Email / UID
              </label>
              <div className="relative rounded-md shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Mail className="h-4 w-4 text-outline" />
                </div>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="operator@inspectra.local"
                  className="block w-full pl-9 pr-3 py-2 bg-surface-container-lowest border border-surface-container-high rounded-lg text-body-sm text-on-surface placeholder:text-outline focus:outline-none focus:border-primary font-mono"
                />
              </div>
            </div>

            <div>
              <label className="block text-label-sm font-mono uppercase text-outline mb-1">
                Passcode / Credentials
              </label>
              <div className="relative rounded-md shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-4 w-4 text-outline" />
                </div>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="block w-full pl-9 pr-3 py-2 bg-surface-container-lowest border border-surface-container-high rounded-lg text-body-sm text-on-surface placeholder:text-outline focus:outline-none focus:border-primary font-mono"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg bg-primary-container hover:bg-secondary-container text-on-primary-container font-headline font-bold text-label-md transition-all shadow-md active:translate-y-px mt-2"
            >
              <span className="material-symbols-outlined text-[18px]">login</span>
              <span>{isSubmitting ? 'Authenticating...' : 'Sign In to Console'}</span>
            </button>
          </form>

          {/* Rapid Demo Login Triggers */}
          <div className="mt-6 pt-5 border-t border-surface-container-high">
            <span className="block text-label-sm font-mono uppercase text-outline text-center mb-3">
              One-Click Terminal Demo Access
            </span>
            <div className="grid grid-cols-3 gap-2 font-mono text-[11px]">
              <button
                type="button"
                onClick={() => handleDemoLogin('carol@example.com', 'qualitymgr123')}
                className="p-2 rounded bg-surface-container hover:bg-surface-container-high border border-outline-variant/30 text-center transition-colors cursor-pointer"
              >
                <span className="text-primary font-bold block">MANAGER</span>
                <span className="text-outline text-[9px]">Carol QualityMgr</span>
              </button>
              <button
                type="button"
                onClick={() => handleDemoLogin('bob@example.com', 'supervisor123')}
                className="p-2 rounded bg-surface-container hover:bg-surface-container-high border border-outline-variant/30 text-center transition-colors cursor-pointer"
              >
                <span className="text-secondary font-bold block">SUPERVISOR</span>
                <span className="text-outline text-[9px]">Bob Supervisor</span>
              </button>
              <button
                type="button"
                onClick={() => handleDemoLogin('alice@example.com', 'inspector123')}
                className="p-2 rounded bg-surface-container hover:bg-surface-container-high border border-outline-variant/30 text-center transition-colors cursor-pointer"
              >
                <span className="text-tertiary font-bold block">INSPECTOR</span>
                <span className="text-outline text-[9px]">Alice Inspector</span>
              </button>
            </div>
          </div>
        </div>

        <div className="mt-4 text-center">
          <span className="text-label-sm font-mono text-outline">
            21 CFR PART 11 COMPLIANT • HARDWARE ENCLAVE SECURED
          </span>
        </div>
      </div>
    </div>
  );
};
