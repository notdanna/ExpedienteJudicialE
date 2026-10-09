'use client';
import React, { useState, useSyncExternalStore } from 'react';
import { ScaleIcon, ShieldLockIcon } from './Icons';

const AUTH_KEY = 'tribunal_auth';

function subscribe(callback: () => void) {
  window.addEventListener('storage', callback);
  return () => window.removeEventListener('storage', callback);
}

function getSnapshot(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return sessionStorage.getItem(AUTH_KEY) === 'true';
  } catch {
    return false;
  }
}

function getServerSnapshot(): boolean {
  return false;
}

export const LoginGate = ({ children }: { children: React.ReactNode }) => {
  const isSessionAuthed = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const [localAuthed, setLocalAuthed] = useState(false);
  const [password, setPassword] = useState('');
  const [error, setError] = useState(false);

  const autenticado = isSessionAuthed || localAuthed;

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    const claveCorrecta = process.env.NEXT_PUBLIC_SITE_PASSWORD;
    if (password === claveCorrecta) {
      try {
        sessionStorage.setItem(AUTH_KEY, 'true');
      } catch (err) {
        console.error('Error al guardar en sessionStorage', err);
      }
      setLocalAuthed(true);
      setError(false);
    } else {
      setError(true);
    }
  };

  if (!autenticado) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-radial from-slate-800 to-slate-950 px-4 py-8">
        <form
          onSubmit={handleLogin}
          className="bg-slate-900/90 backdrop-blur-md p-8 md:p-10 rounded-2xl shadow-2xl w-full max-w-sm border border-slate-700/80 transition-all"
        >
          <div className="flex flex-col items-center mb-6">
            <div className="w-14 h-14 rounded-2xl bg-blue-600/20 border border-blue-500/30 text-blue-400 flex items-center justify-center mb-3 shadow-inner">
              <ScaleIcon className="w-7 h-7" />
            </div>
            <h1 className="text-xl font-bold text-white tracking-tight text-center">
              Expediente Digital
            </h1>
            <p className="text-xs text-slate-400 mt-1 text-center font-medium">
              Acceso Privado al Tribunal Electrónico
            </p>
          </div>

          <div className="space-y-4">
            <div>
              <label htmlFor="gate-password" className="block text-xs font-semibold text-slate-300 mb-1.5">
                Contraseña del Tribunal
              </label>
              <input
                id="gate-password"
                type="password"
                placeholder="Ingresa la clave general..."
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (error) setError(false);
                }}
                className="w-full px-4 py-2.5 bg-slate-800/90 text-slate-100 placeholder-slate-500 text-sm rounded-xl border border-slate-700 focus:outline-hidden focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all"
                autoFocus
                required
              />
            </div>

            {error && (
              <div className="p-2.5 rounded-lg bg-red-950/60 border border-red-800/60 text-red-300 text-xs text-center font-medium">
                Contraseña incorrecta. Verifique la clave e intente de nuevo.
              </div>
            )}

            <button
              type="submit"
              className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white rounded-xl text-sm font-semibold transition-all shadow-md hover:shadow-lg cursor-pointer"
            >
              Ingresar al Expediente
            </button>
          </div>

          <div className="mt-6 pt-4 border-t border-slate-800 text-center">
            <p className="text-[11px] text-slate-500 flex items-center justify-center gap-1.5">
              <ShieldLockIcon className="w-3.5 h-3.5 text-slate-400" />
              <span>Conexión cifrada punto a punto</span>
            </p>
          </div>
        </form>
      </div>
    );
  }

  return <>{children}</>;
};
