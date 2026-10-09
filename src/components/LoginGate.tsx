'use client';
import React, { useState, useEffect, useSyncExternalStore } from 'react';
import { supabase, RolProcesal, UsuarioProcesal } from '../lib/supabase';
import {
  ScaleIcon,
  AlertCircleIcon,
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

const ROLES: { key: RolProcesal; label: string }[] = [
  { key: 'autoridad', label: 'Autoridad (Juzgado)' },
  { key: 'actor', label: 'Parte Actora' },
  { key: 'demandado', label: 'Parte Demandada' },
];

export const LoginGate = ({ children }: { children: React.ReactNode }) => {
  const isSessionAuthed = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const [localAuthed, setLocalAuthed] = useState(false);
  const [selectedRole, setSelectedRole] = useState<RolProcesal>('autoridad');
  const [password, setPassword] = useState('');
  const [cargando, setCargando] = useState(false);
  const [errorMensaje, setErrorMensaje] = useState<string | null>(null);

  // Recordar el rol usado anteriormente en este dispositivo
  useEffect(() => {
    try {
      const cachedRole = localStorage.getItem('tribunal_rol') as RolProcesal | null;
      if (cachedRole === 'autoridad' || cachedRole === 'actor' || cachedRole === 'demandado') {
        setSelectedRole(cachedRole);
      }
    } catch {
      // Ignorar errores de acceso
    }
  }, []);

  const autenticado = isSessionAuthed || localAuthed;

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password.trim()) return;

    setCargando(true);
    setErrorMensaje(null);

    try {
      // 1. Consultar en la base de datos de Supabase la contraseña para el rol seleccionado
      const { data: usuario, error: dbError } = await supabase
        .from('usuarios')
        .select('rol, password')
        .eq('rol', selectedRole)
        .maybeSingle();

      if (dbError) {
        if (dbError.code === '42P01' || dbError.message?.toLowerCase().includes('usuarios')) {
          throw new Error(
            'La tabla "usuarios" no existe en Supabase. Debes ejecutar el script SQL de creación en tu panel de Supabase.'
          );
        }
        throw new Error(`Error de conexión con la base de datos: ${dbError.message}`);
      }

      if (!usuario) {
        throw new Error(
          `No se encontró una contraseña configurada para el rol "${ROLES.find((r) => r.key === selectedRole)?.label}" en la tabla "usuarios".`
        );
      }

      const userTyped = usuario as UsuarioProcesal;

      // 2. Comparar contraseña asignada al rol
      if (password.trim() !== userTyped.password.trim()) {
        throw new Error('Contraseña incorrecta para el rol seleccionado.');
      }

      // 3. Inicio de sesión exitoso: persistir en cache del dispositivo
      try {
        localStorage.setItem(AUTH_KEY, 'true');
        sessionStorage.setItem(AUTH_KEY, 'true');
        localStorage.setItem('tribunal_rol', userTyped.rol);
        localStorage.removeItem('tribunal_nombre');
        window.dispatchEvent(new Event('storage'));
      } catch (err) {
        console.error('Error al guardar en almacenamiento local', err);
      }

      setLocalAuthed(true);
    } catch (err: unknown) {
      console.error('Error en autenticación:', err);
      setErrorMensaje(err instanceof Error ? err.message : 'Error desconocido al iniciar sesión.');
    } finally {
      setCargando(false);
    }
  };

  if (!autenticado) {
    const rolActualLabel = ROLES.find((r) => r.key === selectedRole)?.label || 'Rol Seleccionado';

    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100 px-4 py-8">
        <form
          onSubmit={handleLogin}
          className="bg-white p-6 sm:p-8 rounded-2xl shadow-xl w-full max-w-sm border border-slate-200 transition-all"
        >
          <div className="flex flex-col items-center mb-6">
            <div className="w-14 h-14 rounded-2xl bg-blue-50 border border-blue-200 text-blue-700 flex items-center justify-center mb-3 shadow-2xs">
              <ScaleIcon className="w-7 h-7" />
            </div>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight text-center">
              Expediente Digital
            </h1>
            <p className="text-xs text-slate-500 mt-1 text-center font-medium">
              Acceso al Tribunal Electrónico
            </p>
          </div>

          <div className="space-y-4">
            {/* 1. Selector desplegable de Rol Procesal */}
            <div>
              <label htmlFor="select-rol" className="block text-xs font-semibold text-slate-700 mb-1.5">
                Rol Procesal
              </label>
              <div className="relative">
                <select
                  id="select-rol"
                  value={selectedRole}
                  onChange={(e) => {
                    setSelectedRole(e.target.value as RolProcesal);
                    if (errorMensaje) setErrorMensaje(null);
                  }}
                  className="w-full px-3.5 py-2.5 bg-slate-50 hover:bg-slate-100/60 focus:bg-white text-slate-900 text-sm font-medium rounded-xl border border-slate-300 focus:outline-hidden focus:border-blue-600 focus:ring-2 focus:ring-blue-100 transition-all cursor-pointer appearance-none"
                  disabled={cargando}
                >
                  {ROLES.map((rol) => (
                    <option key={rol.key} value={rol.key}>
                      {rol.label}
                    </option>
                  ))}
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3.5 text-slate-500">
                  <svg className="w-4 h-4 fill-current" viewBox="0 0 20 20">
                    <path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" />
                  </svg>
                </div>
              </div>
            </div>

            {/* 2. Campo de Contraseña para el Rol seleccionado */}
            <div>
              <label htmlFor="gate-password" className="block text-xs font-semibold text-slate-700 mb-1.5">
                Contraseña para {rolActualLabel}
              </label>
              <input
                id="gate-password"
                type="password"
                placeholder="Ingresa la contraseña del rol..."
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (errorMensaje) setErrorMensaje(null);
                }}
                className="w-full px-3.5 py-2.5 bg-slate-50 hover:bg-slate-100/60 focus:bg-white text-slate-900 placeholder-slate-400 text-sm rounded-xl border border-slate-300 focus:outline-hidden focus:border-blue-600 focus:ring-2 focus:ring-blue-100 transition-all"
                required
                disabled={cargando}
              />
            </div>

            {/* Mensaje de error si falla */}
            {errorMensaje && (
              <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-start gap-2">
                <AlertCircleIcon className="w-4 h-4 shrink-0 text-red-600 mt-0.5" />
                <span className="leading-snug">{errorMensaje}</span>
              </div>
            )}

            {/* Botón de acceso */}
            <button
              type="submit"
              disabled={cargando}
              className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white rounded-xl text-sm font-bold transition-all shadow-sm hover:shadow cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2 mt-2"
            >
              {cargando ? (
                <>
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin inline-block" />
                  <span>Verificando contraseña...</span>
                </>
              ) : (
                <span>Ingresar al Expediente</span>
              )}
            </button>
          </div>
        </form>
      </div>
    );
  }

  return <>{children}</>;
};
