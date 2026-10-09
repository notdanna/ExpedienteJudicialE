'use client';
import React, { useState, useEffect, useSyncExternalStore } from 'react';
import { supabase, RolProcesal, UsuarioProcesal } from '../lib/supabase';
import {
  ScaleIcon,
  LandmarkIcon,
  UserIcon,
  UsersIcon,
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
    icon: <LandmarkIcon className="w-4 h-4 text-blue-700" />,
    activeBorder: 'border-blue-600 bg-blue-50/70 ring-2 ring-blue-100',
  },
  {
    key: 'actor',
    label: 'Parte Actora',
    sub: 'Demandas y escritos del demandante',
    icon: <UserIcon className="w-4 h-4 text-emerald-700" />,
    activeBorder: 'border-emerald-600 bg-emerald-50/70 ring-2 ring-emerald-100',
  },
  {
    key: 'demandado',
    label: 'Parte Demandada',
    sub: 'Contestaciones y excepciones de la defensa',
    icon: <UsersIcon className="w-4 h-4 text-purple-700" />,
    activeBorder: 'border-purple-600 bg-purple-50/70 ring-2 ring-purple-100',
  },
];

export const LoginGate = ({ children }: { children: React.ReactNode }) => {
  const isSessionAuthed = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const [localAuthed, setLocalAuthed] = useState(false);
  const [selectedRole, setSelectedRole] = useState<RolProcesal>('autoridad');
  const [password, setPassword] = useState('');
  const [cargando, setCargando] = useState(false);
  const [errorMensaje, setErrorMensaje] = useState<string | null>(null);
  const [nombresRoles, setNombresRoles] = useState<Partial<Record<RolProcesal, string>>>({});

  // Cargar rol recordado y nombres de usuarios registrados en Supabase
  useEffect(() => {
    try {
      const cachedRole = localStorage.getItem('tribunal_rol') as RolProcesal | null;
      if (cachedRole === 'autoridad' || cachedRole === 'actor' || cachedRole === 'demandado') {
        setSelectedRole(cachedRole);
      }
    } catch {
      // Ignorar errores de acceso
    }

    // Consultar nombres de los usuarios directamente de Supabase para mostrarlos en la selección
    async function cargarNombres() {
      try {
        const { data } = await supabase
          .from('usuarios')
          .select('rol, nombre');

        if (data && Array.isArray(data)) {
          const mapa: Partial<Record<RolProcesal, string>> = {};
          data.forEach((u: { rol: RolProcesal; nombre: string }) => {
            if (u.rol && u.nombre) {
              mapa[u.rol] = u.nombre;
            }
          });
          setNombresRoles(mapa);
        }
      } catch {
        // Si la tabla no está creada aún, no bloquear
      }
    }

    cargarNombres();
  }, []);

  const autenticado = isSessionAuthed || localAuthed;

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password.trim()) return;

    setCargando(true);
    setErrorMensaje(null);

    try {
      // 1. Consultar usuario para el rol seleccionado directamente en Supabase
      const { data: usuario, error: dbError } = await supabase
        .from('usuarios')
        .select('*')
        .eq('rol', selectedRole)
        .maybeSingle();

      if (dbError) {
        if (dbError.code === '42P01' || dbError.message?.toLowerCase().includes('usuarios')) {
          throw new Error(
            'La tabla "usuarios" aún no existe en Supabase. Debes ejecutar el script SQL de creación en tu panel de Supabase.'
          );
        }
        throw new Error(`Error al consultar la base de datos: ${dbError.message}`);
      }

      if (!usuario) {
        throw new Error(
          `No se encontró un usuario registrado para el rol "${ROLES_LOGIN.find((r) => r.key === selectedRole)?.label}". Verifica la tabla "usuarios" en Supabase.`
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
        localStorage.setItem('tribunal_nombre', userTyped.nombre || '');
        localStorage.setItem('tribunal_user_id', userTyped.id || '');
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
    const rolActualConfig = ROLES_LOGIN.find((r) => r.key === selectedRole)!;

    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100 px-4 py-8">
        <form
          onSubmit={handleLogin}
          className="bg-white p-6 sm:p-8 rounded-2xl shadow-xl w-full max-w-md border border-slate-200 transition-all"
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
            {/* Selección de Rol Procesal */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-2">
                Selecciona tu Cuenta / Rol Procesal
              </label>
              <div className="space-y-2">
                {ROLES_LOGIN.map((rol) => {
                  const isSelected = selectedRole === rol.key;
                  const nombreEnBase = nombresRoles[rol.key];

                  return (
                    <button
                      key={rol.key}
                      type="button"
                      onClick={() => {
                        setSelectedRole(rol.key);
                        if (errorMensaje) setErrorMensaje(null);
                      }}
                      className={`w-full p-2.5 rounded-xl border text-left cursor-pointer transition-all flex items-center justify-between gap-3 ${
                        isSelected
                          ? rol.activeBorder
                          : 'border-slate-200 bg-slate-50/60 hover:bg-slate-100/80 text-slate-700 hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-8 h-8 rounded-lg bg-white border border-slate-200 flex items-center justify-center shrink-0 shadow-2xs">
                          {rol.icon}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="text-xs font-bold leading-tight text-slate-900 truncate">
                            {rol.label}
                          </div>
                          <div className="text-[11px] text-slate-500 mt-0.5 leading-snug truncate">
                            {nombreEnBase ? (
                              <span className="text-slate-700 font-semibold">{nombreEnBase}</span>
                            ) : (
                              rol.sub
                            )}
                          </div>
                        </div>
                      </div>
                      <div
                        className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ${
                          isSelected ? 'border-blue-600 bg-blue-600' : 'border-slate-300'
                        }`}
                      >
                        {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Contraseña del Rol Seleccionado */}
            <div>
              <label htmlFor="gate-password" className="block text-xs font-semibold text-slate-700 mb-1.5">
                Contraseña para {rolActualConfig.label}
              </label>
              <input
                id="gate-password"
                type="password"
                placeholder="Ingresa la contraseña asignada..."
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

            {errorMensaje && (
              <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-start gap-2">
                <AlertCircleIcon className="w-4 h-4 shrink-0 text-red-600 mt-0.5" />
                <span className="leading-snug">{errorMensaje}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={cargando}
              className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white rounded-xl text-sm font-bold transition-all shadow-sm hover:shadow cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {cargando ? (
                <>
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin inline-block" />
                  <span>Verificando credenciales...</span>
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
