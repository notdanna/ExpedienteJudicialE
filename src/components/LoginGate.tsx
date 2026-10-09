'use client';
import React, { useState, useEffect, useSyncExternalStore } from 'react';
import { RolProcesal } from '../lib/supabase';
import {
  ScaleIcon,
  ShieldLockIcon,
  LandmarkIcon,
  UserIcon,
  UsersIcon,
} from './Icons';

const AUTH_KEY = 'tribunal_auth';

function subscribe(callback: () => void) {
  window.addEventListener('storage', callback);
  return () => window.removeEventListener('storage', callback);
}

function getSnapshot(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return localStorage.getItem(AUTH_KEY) === 'true' || sessionStorage.getItem(AUTH_KEY) === 'true';
  } catch {
    return false;
  }
}

function getServerSnapshot(): boolean {
  return false;
}

const ROLES_LOGIN: {
  key: RolProcesal;
  label: string;
  sub: string;
  icon: React.ReactNode;
  activeBorder: string;
}[] = [
  {
    key: 'autoridad',
    label: 'Autoridad (Juzgado)',
    sub: 'Resoluciones, acuerdos y notificaciones',
    icon: <LandmarkIcon className="w-4 h-4 text-blue-400" />,
    activeBorder: 'border-blue-500 bg-blue-950/40 ring-2 ring-blue-500/20 text-white',
  },
  {
    key: 'actor',
    label: 'Parte Actora',
    sub: 'Demandas y escritos del demandante',
    icon: <UserIcon className="w-4 h-4 text-emerald-400" />,
    activeBorder: 'border-emerald-500 bg-emerald-950/40 ring-2 ring-emerald-500/20 text-white',
  },
  {
    key: 'demandado',
    label: 'Parte Demandada',
    sub: 'Contestaciones y excepciones de la defensa',
    icon: <UsersIcon className="w-4 h-4 text-purple-400" />,
    activeBorder: 'border-purple-500 bg-purple-950/40 ring-2 ring-purple-500/20 text-white',
  },
];

export const LoginGate = ({ children }: { children: React.ReactNode }) => {
  const isSessionAuthed = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const [localAuthed, setLocalAuthed] = useState(false);
  const [selectedRole, setSelectedRole] = useState<RolProcesal>('autoridad');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(false);

  // Cargar rol recordado en la memoria del dispositivo
  useEffect(() => {
    try {
      const cachedRole = localStorage.getItem('tribunal_rol') as RolProcesal | null;
      if (cachedRole === 'autoridad' || cachedRole === 'actor' || cachedRole === 'demandado') {
        setSelectedRole(cachedRole);
      }
    } catch {
      // Ignorar errores de acceso en entornos restringidos
    }
  }, []);

  const autenticado = isSessionAuthed || localAuthed;

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    const claveCorrecta = process.env.NEXT_PUBLIC_SITE_PASSWORD || 'Tribunal2026';
    if (password === claveCorrecta) {
      try {
        localStorage.setItem(AUTH_KEY, 'true');
        sessionStorage.setItem(AUTH_KEY, 'true');
        localStorage.setItem('tribunal_rol', selectedRole);
        localStorage.removeItem('tribunal_nombre');
        window.dispatchEvent(new Event('storage'));
      } catch (err) {
        console.error('Error al guardar en almacenamiento local', err);
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
          className="bg-slate-900/90 backdrop-blur-md p-6 sm:p-8 rounded-2xl shadow-2xl w-full max-w-md border border-slate-700/80 transition-all"
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
            {/* Selección de Rol Procesal */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-2">
                Selecciona tu Rol Procesal en este equipo
              </label>
              <div className="space-y-2">
                {ROLES_LOGIN.map((rol) => {
                  const isSelected = selectedRole === rol.key;
                  return (
                    <button
                      key={rol.key}
                      type="button"
                      onClick={() => setSelectedRole(rol.key)}
                      className={`w-full p-2.5 rounded-xl border text-left cursor-pointer transition-all flex items-center justify-between gap-3 ${
                        isSelected
                          ? rol.activeBorder
                          : 'border-slate-800 bg-slate-800/40 hover:bg-slate-800 text-slate-300'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-slate-800/90 border border-slate-700/80 flex items-center justify-center shrink-0">
                          {rol.icon}
                        </div>
                        <div>
                          <div className="text-xs font-bold leading-tight text-slate-100">
                            {rol.label}
                          </div>
                          <div className="text-[11px] text-slate-400 mt-0.5 leading-snug">
                            {rol.sub}
                          </div>
                        </div>
                      </div>
                      <div
                        className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ${
                          isSelected ? 'border-blue-500 bg-blue-600' : 'border-slate-600'
                        }`}
                      >
                        {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Contraseña del Tribunal */}
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
                className="w-full px-3.5 py-2.5 bg-slate-800/90 text-slate-100 placeholder-slate-500 text-sm rounded-xl border border-slate-700 focus:outline-hidden focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all"
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
              <span>Conexión cifrada punto a punto • Acceso confidencial</span>
            </p>
          </div>
        </form>
      </div>
    );
  }

  return <>{children}</>;
};
