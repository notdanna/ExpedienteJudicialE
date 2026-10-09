'use client';
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase, DocumentoProcesal, RolProcesal, SeccionProcesal } from '../lib/supabase';
import { PdfViewerModal } from './PdfViewerModal';
import { PdfThumbnail } from './PdfThumbnail';
import {
  ScaleIcon,
  SearchIcon,
  XIcon,
  RefreshIcon,
  FilePdfIcon,
  DownloadIcon,
  PlusIcon,
  LockIcon,
  FolderEmptyIcon,
  ColumnsIcon,
  ListIcon,
  LandmarkIcon,
  UserIcon,
  UsersIcon,
  StarIcon,
  PenToolIcon,
  ClockIcon,
  EyeIcon,
  CheckIcon,
  ArrowLeftIcon,
  MaximizeIcon,
  TrashIcon,
  ChevronDownIcon,
  LogOutIcon,
  UserCircleIcon,
  ShareIcon,
  LinkIcon,
  CopyIcon,
} from './Icons';

const LIMITE_TAMANO_MB = 50;
const LIMITE_TAMANO_BYTES = LIMITE_TAMANO_MB * 1024 * 1024;

interface SeccionConfig {
  key: SeccionProcesal;
  label: string;
  subtitulo: string;
  activeBorder: string;
  activeHeaderBg: string;
  activeBadgeClass: string;
  activeIcon: React.ReactNode;
  btnColor: string;
  inactiveIcon: React.ReactNode;
}

const SECCIONES: SeccionConfig[] = [
  {
    key: 'autoridad',
    label: 'Actuaciones de Autoridad',
    subtitulo: 'Acuerdos, resoluciones y notificaciones del Juzgado',
    activeBorder: 'border-2 border-blue-600 shadow-md ring-2 ring-blue-100',
    activeHeaderBg: 'bg-blue-50/90 border-b border-blue-300',
    activeBadgeClass: 'bg-blue-600 text-white border-blue-600',
    activeIcon: <LandmarkIcon className="w-4 h-4 text-blue-700" />,
    btnColor: 'bg-blue-600 hover:bg-blue-700',
    inactiveIcon: <LandmarkIcon className="w-4 h-4 text-slate-400" />,
  },
  {
    key: 'actor',
    label: 'Promociones del Actor',
    subtitulo: 'Demandas, anexos y escritos de la parte actora',
    activeBorder: 'border-2 border-emerald-600 shadow-md ring-2 ring-emerald-100',
    activeHeaderBg: 'bg-emerald-50/90 border-b border-emerald-300',
    activeBadgeClass: 'bg-emerald-600 text-white border-emerald-600',
    activeIcon: <UserIcon className="w-4 h-4 text-emerald-700" />,
    btnColor: 'bg-emerald-600 hover:bg-emerald-700',
    inactiveIcon: <UserIcon className="w-4 h-4 text-slate-400" />,
  },
  {
    key: 'demandado',
    label: 'Promociones del Demandado',
    subtitulo: 'Contestaciones, excepciones y escritos del demandado',
    activeBorder: 'border-2 border-purple-600 shadow-md ring-2 ring-purple-100',
    activeHeaderBg: 'bg-purple-50/90 border-b border-purple-300',
    activeBadgeClass: 'bg-purple-600 text-white border-purple-600',
    activeIcon: <UsersIcon className="w-4 h-4 text-purple-700" />,
    btnColor: 'bg-purple-600 hover:bg-purple-700',
    inactiveIcon: <UsersIcon className="w-4 h-4 text-slate-400" />,
  },
];

const ROL_LABELS: Record<RolProcesal, string> = {
  autoridad: 'Autoridad (Juzgado)',
  actor: 'Parte Actora',
  demandado: 'Parte Demandada',
};

function generarRutaStorage(nombreOriginal: string): string {
  const timestamp = Date.now();
  const nombreSanitizado = nombreOriginal
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9.-]/g, '_');
  return `${timestamp}-${nombreSanitizado}`;
}

function formatearFechaHora(fechaIso: string): string {
  try {
    const fecha = new Date(fechaIso);
    return fecha.toLocaleString('es-MX', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  } catch {
    return fechaIso;
  }
}

export const ExpedienteView = () => {
  const [rolActual, setRolActual] = useState<RolProcesal>('autoridad');
  const [documentos, setDocumentos] = useState<DocumentoProcesal[]>([]);
  const [docSeleccionado, setDocSeleccionado] = useState<DocumentoProcesal | null>(null);
  const [subiendo, setSubiendo] = useState(false);
  const [cargandoLista, setCargandoLista] = useState(true);
  const [busqueda, setBusqueda] = useState('');
  const [vistaModo, setVistaModo] = useState<'columnas' | 'lista'>('columnas');
  const [seccionDragOver, setSeccionDragOver] = useState<SeccionProcesal | null>(null);
  const [filtroSoloAnotados, setFiltroSoloAnotados] = useState(false);
  const [seccionIndividual, setSeccionIndividual] = useState<SeccionProcesal | null>(null);
  const [docAEliminar, setDocAEliminar] = useState<DocumentoProcesal | null>(null);
  const [eliminando, setEliminando] = useState(false);
  const [modalRolAbierto, setModalRolAbierto] = useState(false);
  const [tempRol, setTempRol] = useState<RolProcesal>('autoridad');
  const [docACompartir, setDocACompartir] = useState<DocumentoProcesal | null>(null);
  const [enlaceCopiado, setEnlaceCopiado] = useState(false);

  const handleCompartirDocumento = async (e: React.MouseEvent, doc: DocumentoProcesal) => {
    e.stopPropagation();
    setDocACompartir(doc);
    setEnlaceCopiado(false);
    try {
      const url = `${window.location.origin}/ver/${doc.id}`;
      await navigator.clipboard.writeText(url);
      setEnlaceCopiado(true);
    } catch {
      // Ignorar fallo de portapapeles
    }
  };

  // Sincronizar rol recordado en la memoria del dispositivo
  useEffect(() => {
    try {
      const cachedRol = localStorage.getItem('tribunal_rol') as RolProcesal | null;
      if (cachedRol === 'autoridad' || cachedRol === 'actor' || cachedRol === 'demandado') {
        setRolActual(cachedRol);
        setTempRol(cachedRol);
      }
    } catch {
      // Ignorar errores de acceso
    }
  }, []);

  const abrirModalRol = () => {
    setTempRol(rolActual);
    setModalRolAbierto(true);
  };

  const guardarRol = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setRolActual(tempRol);
    try {
      localStorage.setItem('tribunal_rol', tempRol);
    } catch (err) {
      console.error('Error al guardar en almacenamiento local', err);
    }
    setModalRolAbierto(false);
  };

  const handleCerrarSesion = () => {
    if (
      window.confirm(
        '¿Deseas cerrar sesión en este dispositivo? Deberás ingresar la contraseña nuevamente para acceder.'
      )
    ) {
      try {
        localStorage.removeItem('tribunal_auth');
        sessionStorage.removeItem('tribunal_auth');
        window.dispatchEvent(new Event('storage'));
      } catch {
        // Ignorar
      }
      window.location.reload();
    }
  };

  const cargarDocumentos = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('documentos')
        .select('*')
        .order('created_at', { ascending: true });

      if (error) {
        console.error('Error al cargar documentos:', error.message);
        return;
      }

      if (data) {
        setDocumentos(data as DocumentoProcesal[]);
      }
    } finally {
      setCargandoLista(false);
    }
  }, []);

  useEffect(() => {
    let activo = true;

    async function inicializar() {
      const { data, error } = await supabase
        .from('documentos')
        .select('*')
        .order('created_at', { ascending: true });

      if (!activo) return;

      if (error) {
        console.error('Error al cargar documentos:', error.message);
      } else if (data) {
        setDocumentos(data as DocumentoProcesal[]);
      }
      setCargandoLista(false);
    }

    inicializar();

    return () => {
      activo = false;
    };
  }, []);

  const procesarArchivoSubida = async (file: File, seccion: SeccionProcesal) => {
    if (file.type !== 'application/pdf') {
      alert('Solo se admiten documentos en formato PDF.');
      return;
    }

    if (file.size > LIMITE_TAMANO_BYTES) {
      alert(`El archivo supera el límite de ${LIMITE_TAMANO_MB} MB permitido.`);
      return;
    }

    setSubiendo(true);
    const path = generarRutaStorage(file.name);

    try {
      const { error: uploadErr } = await supabase.storage
        .from('expedientes-pdf')
        .upload(path, file, {
          contentType: 'application/pdf',
          cacheControl: '0',
          upsert: false,
        });

      if (uploadErr) {
        alert(`Error al subir archivo a la nube: ${uploadErr.message}`);
        return;
      }

      const tituloLimpio = file.name.replace(/\.[^/.]+$/, '');
      const { error: insertErr } = await supabase.from('documentos').insert({
        seccion,
        titulo: tituloLimpio,
        storage_path: path,
        creado_por: rolActual,
      });

      if (insertErr) {
        alert(`Error al registrar en base de datos: ${insertErr.message}`);
        return;
      }

      await cargarDocumentos();
    } catch (err: unknown) {
      const mensaje = err instanceof Error ? err.message : 'Error inesperado';
      alert(`Ocurrió un error al procesar el archivo: ${mensaje}`);
    } finally {
      setSubiendo(false);
    }
  };

  const handleSubirArchivoInput = async (e: React.ChangeEvent<HTMLInputElement>, seccion: SeccionProcesal) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await procesarArchivoSubida(file, seccion);
    e.target.value = '';
  };

  const handleDrop = async (e: React.DragEvent, seccion: SeccionProcesal) => {
    e.preventDefault();
    setSeccionDragOver(null);
    if (rolActual !== seccion) {
      alert(`Tu rol actual (${ROL_LABELS[rolActual]}) no tiene permisos para subir a esta sección.`);
      return;
    }
    const file = e.dataTransfer.files?.[0];
    if (file) {
      await procesarArchivoSubida(file, seccion);
    }
  };

  const handleDescargarDirecto = async (e: React.MouseEvent, doc: DocumentoProcesal) => {
    e.stopPropagation();
    try {
      const { data, error } = await supabase.storage
        .from('expedientes-pdf')
        .download(doc.storage_path);

      if (error || !data) throw error || new Error('No se pudo descargar el archivo');

      const url = URL.createObjectURL(data);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${doc.titulo}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error de descarga';
      alert(`No se pudo descargar: ${msg}`);
    }
  };

  const puedeEliminarDocumento = (doc: DocumentoProcesal): boolean => {
    // La Autoridad puede eliminar cualquier escrito para mantener el control procesal
    // Cada parte procesal puede eliminar los escritos de su propia sección
    return rolActual === 'autoridad' || rolActual === doc.seccion;
  };

  const handleSolicitarEliminar = (e: React.MouseEvent, doc: DocumentoProcesal) => {
    e.stopPropagation();
    if (!puedeEliminarDocumento(doc)) {
      alert(
        `Tu rol actual (${ROL_LABELS[rolActual]}) no tiene permisos para eliminar escritos de la sección "${ROL_LABELS[doc.seccion]}". Puedes actuar como Autoridad o cambiar a ese rol para gestionar sus documentos.`
      );
      return;
    }
    setDocAEliminar(doc);
  };

  const handleSolicitarEliminarDesdeVisor = (doc: DocumentoProcesal) => {
    if (!puedeEliminarDocumento(doc)) {
      alert(
        `Tu rol actual (${ROL_LABELS[rolActual]}) no tiene permisos para eliminar escritos de la sección "${ROL_LABELS[doc.seccion]}". Puedes actuar como Autoridad o cambiar a ese rol para gestionar sus documentos.`
      );
      return;
    }
    setDocAEliminar(doc);
  };

  const confirmarEliminarDocumento = async () => {
    if (!docAEliminar) return;

    setEliminando(true);
    try {
      // 1. Eliminar el registro en la base de datos
      const { error: dbError } = await supabase
        .from('documentos')
        .delete()
        .eq('id', docAEliminar.id);

      if (dbError) {
        throw new Error(`Error en base de datos: ${dbError.message}`);
      }

      // 2. Eliminar el archivo del bucket de almacenamiento en Supabase
      const { error: storageError } = await supabase.storage
        .from('expedientes-pdf')
        .remove([docAEliminar.storage_path]);

      if (storageError) {
        console.warn('Aviso: el archivo en almacenamiento no pudo borrarse:', storageError.message);
      }

      // Si el visor de PDF estaba abierto con este documento, cerrarlo
      if (docSeleccionado?.id === docAEliminar.id) {
        setDocSeleccionado(null);
      }

      // Cerrar modal de confirmación y recargar la lista
      setDocAEliminar(null);
      await cargarDocumentos();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al eliminar el documento';
      alert(`No se pudo eliminar el documento: ${msg}`);
    } finally {
      setEliminando(false);
    }
  };

  // Filtrado de documentos por texto (insensible a mayúsculas y acentos) y por anotaciones
  const documentosFiltrados = useMemo(() => {
    const normalizar = (txt: string) =>
      txt.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    const queryNorm = normalizar(busqueda.trim());

    return documentos.filter((d) => {
      const coincideTexto =
        queryNorm === '' ||
        normalizar(d.titulo).includes(queryNorm) ||
        normalizar(d.creado_por).includes(queryNorm) ||
        (d.modificado_por && normalizar(d.modificado_por).includes(queryNorm));

      const coincideAnotado = !filtroSoloAnotados || Boolean(d.modificado_por);

      return coincideTexto && coincideAnotado;
    });
  }, [documentos, busqueda, filtroSoloAnotados]);

  const totalAnotados = useMemo(() => {
    return documentos.filter((d) => Boolean(d.modificado_por)).length;
  }, [documentos]);

  return (
    <div className="min-h-screen bg-slate-100/80 text-slate-800 flex flex-col font-sans">
      {/* 1. BARRA SUPERIOR PROFESIONAL SIN EMOJIS */}
      <header className="sticky top-0 z-40 bg-white border-b border-slate-200 shadow-2xs px-4 lg:px-8 py-2.5">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-3">
          {/* Logo y título de la plataforma */}
          <div className="flex items-center gap-3 w-full md:w-auto justify-between md:justify-start">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-blue-700 text-white flex items-center justify-center shadow-xs">
                <ScaleIcon className="w-5 h-5" />
              </div>
              <div>
                <h1 className="text-base font-bold text-slate-900 tracking-tight leading-none">
                  Expediente Digital
                </h1>
                <span className="text-[11px] font-medium text-slate-500">Tribunal de Control Judicial</span>
              </div>
            </div>

            {/* Badge de estado en móvil */}
            <span className="md:hidden text-[10px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-semibold border border-emerald-200">
              En Línea
            </span>
          </div>

          {/* Barra de búsqueda central */}
          <div className="w-full md:max-w-md lg:max-w-lg relative">
            <div className="relative flex items-center">
              <SearchIcon className="absolute left-3.5 text-slate-400 w-4 h-4 pointer-events-none" />
              <input
                type="text"
                placeholder="Buscar escritos por nombre, fecha o parte..."
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                className="w-full pl-9 pr-9 py-2 bg-slate-100 hover:bg-slate-200/70 focus:bg-white text-slate-800 text-xs rounded-full border border-transparent focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all outline-hidden"
              />
              {busqueda && (
                <button
                  onClick={() => setBusqueda('')}
                  className="absolute right-3 text-slate-400 hover:text-slate-600 text-xs w-4 h-4 rounded-full bg-slate-200 flex items-center justify-center cursor-pointer"
                  title="Limpiar búsqueda"
                >
                  <XIcon className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>

          {/* Selector de Rol Activo Discreto y Botón de Actualizar */}
          <div className="flex items-center gap-2 w-full md:w-auto justify-end">
            <button
              type="button"
              onClick={abrirModalRol}
              className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-medium shadow-2xs hover:shadow-xs transition-all cursor-pointer group"
              title="Configuración de Rol Procesal en este equipo"
            >
              <div className="flex items-center gap-1.5">
                <span
                  className={`w-2 h-2 rounded-full ${
                    rolActual === 'autoridad'
                      ? 'bg-blue-600 ring-2 ring-blue-200'
                      : rolActual === 'actor'
                      ? 'bg-emerald-600 ring-2 ring-emerald-200'
                      : 'bg-purple-600 ring-2 ring-purple-200'
                  }`}
                />
                <span className="font-bold text-slate-800">
                  {ROL_LABELS[rolActual]}
                </span>
              </div>
              <ChevronDownIcon className="w-3.5 h-3.5 text-slate-400 group-hover:text-slate-600 transition-colors ml-0.5" />
            </button>

            <button
              onClick={() => cargarDocumentos()}
              disabled={cargandoLista}
              className="p-2 text-slate-600 hover:text-blue-700 hover:bg-slate-100 rounded-xl transition-colors border border-slate-300 shadow-2xs cursor-pointer"
              title="Actualizar expediente"
            >
              <RefreshIcon className={`w-4 h-4 ${cargandoLista ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </header>

      {/* 2. SUB-BARRA DE HERRAMIENTAS: CONTADORES, IDENTIDAD ACTIVA Y VISTA */}
      <div className="bg-white border-b border-slate-200 px-4 lg:px-8 py-2">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
          {/* Identidad Activa y Chips de filtro */}
          <div className="flex items-center gap-2.5 flex-wrap">
            <div className="flex items-center gap-2">
              <span
                className={`inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1 rounded-full border shadow-2xs ${
                  rolActual === 'autoridad'
                    ? 'bg-blue-100 text-blue-900 border-blue-300'
                    : rolActual === 'actor'
                    ? 'bg-emerald-100 text-emerald-900 border-emerald-300'
                    : 'bg-purple-100 text-purple-900 border-purple-300'
                }`}
              >
                {rolActual === 'autoridad' && <LandmarkIcon className="w-3.5 h-3.5 text-blue-700" />}
                {rolActual === 'actor' && <UserIcon className="w-3.5 h-3.5 text-emerald-700" />}
                {rolActual === 'demandado' && <UsersIcon className="w-3.5 h-3.5 text-purple-700" />}
                <span>Actuando como: {ROL_LABELS[rolActual]}</span>
              </span>
              <button
                type="button"
                onClick={abrirModalRol}
                className="text-[11px] text-slate-500 hover:text-blue-700 hover:underline font-semibold cursor-pointer"
                title="Cambiar rol procesal en este equipo"
              >
                (Cambiar)
              </button>
            </div>

            {seccionIndividual && (
              <button
                type="button"
                onClick={() => setSeccionIndividual(null)}
                className="inline-flex items-center gap-1.5 px-3 py-1 bg-red-600 hover:bg-red-700 active:bg-red-800 text-white text-xs font-bold rounded-full shadow-xs hover:shadow transition-all cursor-pointer ring-2 ring-red-200"
                title="Volver a la vista general de 3 columnas"
              >
                <ArrowLeftIcon className="w-3.5 h-3.5 text-white" />
                <span>Volver a 3 Columnas</span>
              </button>
            )}

            <div className="h-4 w-px bg-slate-200 hidden sm:block" />

            <button
              onClick={() => setFiltroSoloAnotados(false)}
              className={`text-xs px-3 py-1 rounded-full font-medium transition-colors cursor-pointer ${
                !filtroSoloAnotados
                  ? 'bg-slate-900 text-white shadow-2xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Todos ({documentos.length})
            </button>
            <button
              onClick={() => setFiltroSoloAnotados(!filtroSoloAnotados)}
              className={`text-xs px-3 py-1 rounded-full font-medium transition-colors flex items-center gap-1.5 cursor-pointer ${
                filtroSoloAnotados
                  ? 'bg-amber-600 text-white shadow-2xs'
                  : 'bg-amber-50 text-amber-800 hover:bg-amber-100 border border-amber-300'
              }`}
            >
              <StarIcon className="w-3.5 h-3.5" />
              <span>Con notas y resaltados ({totalAnotados})</span>
            </button>
          </div>

          {/* Selector de modo Cuadrícula vs Lista */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400 hidden sm:inline">Vista:</span>
            <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200">
              <button
                type="button"
                onClick={() => {
                  setSeccionIndividual(null);
                  setVistaModo('columnas');
                }}
                className={`px-2.5 py-1 text-xs rounded-md font-medium transition-colors flex items-center gap-1.5 cursor-pointer ${
                  vistaModo === 'columnas' && !seccionIndividual
                    ? 'bg-white text-slate-800 shadow-2xs font-bold'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
                title="Vista en 3 Columnas Procesales"
              >
                <ColumnsIcon className="w-3.5 h-3.5" />
                <span>Columnas</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setSeccionIndividual(null);
                  setVistaModo('lista');
                }}
                className={`px-2.5 py-1 text-xs rounded-md font-medium transition-colors flex items-center gap-1.5 cursor-pointer ${
                  vistaModo === 'lista' && !seccionIndividual
                    ? 'bg-white text-slate-800 shadow-2xs font-bold'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
                title="Vista de Lista Detallada"
              >
                <ListIcon className="w-3.5 h-3.5" />
                <span>Lista</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 3. CONTENIDO PRINCIPAL */}
      <main className="max-w-7xl mx-auto w-full p-4 lg:p-6 flex-1">
        {busqueda && (
          <div className="mb-4 bg-blue-50 border border-blue-200 text-blue-900 text-xs px-4 py-2 rounded-lg flex items-center justify-between">
            <span>
              Filtrando resultados para: <strong className="font-semibold">&quot;{busqueda}&quot;</strong> ({documentosFiltrados.length} encontrados)
            </span>
            <button
              onClick={() => setBusqueda('')}
              className="text-blue-700 hover:underline font-semibold text-xs cursor-pointer"
            >
              Mostrar todos
            </button>
          </div>
        )}

        {/* MODO A: 3 COLUMNAS PROCESALES CON BORDE COMPLETO Y TARJETAS COMPACTAS */}
        {vistaModo === 'columnas' && !seccionIndividual && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 items-start">
            {SECCIONES.map((sec) => {
              const docsSeccion = documentosFiltrados.filter((d) => d.seccion === sec.key);
              const puedeSubir = rolActual === sec.key;
              const isDragTarget = seccionDragOver === sec.key;

              // Solo la columna del rol activo tiene borde de color resaltado; las otras dos tienen borde gris estable
              const containerBorder = puedeSubir
                ? sec.activeBorder
                : 'border-2 border-slate-300 shadow-2xs';
              const headerBg = puedeSubir
                ? sec.activeHeaderBg
                : 'bg-slate-100/80 border-b border-slate-200';
              const iconToRender = puedeSubir ? sec.activeIcon : sec.inactiveIcon;
              const badgeClass = puedeSubir
                ? sec.activeBadgeClass
                : 'bg-slate-200 text-slate-600 border-slate-300';

              return (
                <section
                  key={sec.key}
                  onDragOver={(e) => {
                    e.preventDefault();
                    if (puedeSubir) setSeccionDragOver(sec.key);
                  }}
                  onDragLeave={() => setSeccionDragOver(null)}
                  onDrop={(e) => handleDrop(e, sec.key)}
                  className={`bg-white rounded-xl transition-all duration-200 flex flex-col overflow-hidden ${containerBorder} ${
                    isDragTarget ? 'ring-3 ring-blue-300 scale-[1.01]' : ''
                  }`}
                >
                  {/* Cabecera de la sección procesal - Clic para ver vista individual ampliada */}
                  <div
                    onClick={() => setSeccionIndividual(sec.key)}
                    className={`p-3.5 ${headerBg} flex items-start justify-between gap-2 cursor-pointer group/header hover:brightness-[0.98] transition-all`}
                    title={`Clic para ver únicamente ${sec.label} en vista completa con fotos grandes`}
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        {iconToRender}
                        <h2 className="text-sm font-bold text-slate-900 leading-tight group-hover/header:text-blue-700 transition-colors">
                          {sec.label}
                        </h2>
                      </div>
                      <p className="text-[11px] text-slate-600 mt-0.5 leading-snug">{sec.subtitulo}</p>
                      <div className="mt-2 flex items-center gap-2 flex-wrap">
                        {puedeSubir ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-600 text-white shadow-xs">
                            <CheckIcon className="w-2.5 h-2.5" /> Tu Columna Activa • Puedes subir escritos
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full bg-slate-200/90 text-slate-600">
                            <LockIcon className="w-2.5 h-2.5 text-slate-400" /> Solo consulta y lectura
                          </span>
                        )}
                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-blue-600 group-hover/header:underline">
                          <MaximizeIcon className="w-2.5 h-2.5" /> Ver en grande
                        </span>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1.5 shrink-0">
                      <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full border ${badgeClass}`}>
                        {docsSeccion.length}
                      </span>
                      <span
                        className="text-slate-400 group-hover/header:text-blue-600 transition-colors p-0.5"
                        title="Ver en pantalla completa con vista previa grande"
                      >
                        <MaximizeIcon className="w-3.5 h-3.5" />
                      </span>
                    </div>
                  </div>

                  {/* Botón de subida de archivos o aviso de solo lectura */}
                  <div className="p-3 bg-slate-50 border-b border-slate-200">
                    {puedeSubir ? (
                      <label className={`w-full py-2 px-3 ${sec.btnColor} text-white rounded-lg text-xs font-semibold cursor-pointer transition-all shadow-xs flex items-center justify-center gap-1.5 active:scale-[0.99]`}>
                        <PlusIcon className="w-3.5 h-3.5" />
                        <span>{subiendo ? 'Subiendo escrito...' : 'Subir Escrito (PDF)'}</span>
                        <input
                          type="file"
                          accept="application/pdf"
                          className="hidden"
                          disabled={subiendo}
                          onChange={(e) => handleSubirArchivoInput(e, sec.key)}
                        />
                      </label>
                    ) : (
                      <div className="w-full py-2 px-3 bg-slate-100 rounded-lg text-center text-xs text-slate-500 font-medium border border-slate-200 flex items-center justify-center gap-1.5">
                        <LockIcon className="w-3.5 h-3.5 text-slate-400" />
                        <span>Solo lectura para tu rol</span>
                      </div>
                    )}
                  </div>

                  {/* Lista de tarjetas compactas con scroll interno independiente */}
                  <div className="p-3 space-y-2.5 max-h-[calc(100vh-250px)] overflow-y-auto">
                    {cargandoLista && documentos.length === 0 ? (
                      <div className="py-8 flex flex-col items-center justify-center text-slate-400 gap-2">
                        <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                        <span className="text-xs">Cargando actuaciones...</span>
                      </div>
                    ) : docsSeccion.length > 0 ? (
                      docsSeccion.map((doc) => (
                        <article
                          key={doc.id}
                          onClick={() => setDocSeleccionado(doc)}
                          className="group bg-white rounded-lg border border-slate-200 hover:border-blue-400 hover:shadow-sm transition-all cursor-pointer p-2.5 flex gap-2.5 items-stretch"
                        >
                          {/* Miniatura compacta proporcionada (A4 mini) */}
                          <PdfThumbnail
                            storagePath={doc.storage_path}
                            titulo={doc.titulo}
                            updatedAt={doc.updated_at}
                            className="w-18 h-24 shrink-0"
                          />

                          {/* Metadatos y acciones del documento en formato horizontal compacto */}
                          <div className="flex-1 min-w-0 flex flex-col justify-between py-0.5">
                            <div>
                              <div className="flex items-start gap-1.5">
                                <FilePdfIcon className="w-3.5 h-3.5 text-red-600 shrink-0 mt-0.5" />
                                <h3
                                  className="text-xs font-bold text-slate-900 group-hover:text-blue-700 transition-colors line-clamp-2 leading-tight"
                                  title={doc.titulo}
                                >
                                  {doc.titulo}
                                </h3>
                              </div>

                              <div className="mt-1.5 text-[10px] text-slate-500 space-y-0.5">
                                <p className="truncate">
                                  Por: <span className="font-semibold text-slate-700">{ROL_LABELS[doc.creado_por] || doc.creado_por}</span>
                                </p>
                                <p className="flex items-center gap-1 text-slate-400">
                                  <ClockIcon className="w-2.5 h-2.5 shrink-0" />
                                  <span>{formatearFechaHora(doc.created_at)}</span>
                                </p>
                              </div>
                            </div>

                            {/* Badge compacto de notas si existen */}
                            {doc.modificado_por && (
                              <div className="mt-1 bg-amber-50 border border-amber-200 rounded px-1.5 py-0.5 text-[9px] text-amber-800 flex items-center gap-1 truncate">
                                <PenToolIcon className="w-2.5 h-2.5 text-amber-600 shrink-0" />
                                <span className="truncate">Notas de {ROL_LABELS[doc.modificado_por] || doc.modificado_por}</span>
                              </div>
                            )}

                            {/* Acciones directas al pie */}
                            <div className="mt-1.5 pt-1 border-t border-slate-100 flex items-center justify-between gap-1">
                              <span className="text-[11px] font-semibold text-blue-600 group-hover:text-blue-800 flex items-center gap-1">
                                <EyeIcon className="w-3 h-3" />
                                <span>Ver y Anotar</span>
                              </span>

                              <div className="flex items-center gap-0.5">
                                <button
                                  type="button"
                                  onClick={(e) => handleCompartirDocumento(e, doc)}
                                  className="text-slate-400 hover:text-blue-600 hover:bg-blue-50 p-1 rounded transition-colors cursor-pointer"
                                  title="Compartir enlace público de este documento"
                                >
                                  <ShareIcon className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={(e) => handleDescargarDirecto(e, doc)}
                                  className="text-slate-400 hover:text-slate-700 hover:bg-slate-100 p-1 rounded transition-colors cursor-pointer"
                                  title="Descargar PDF directamente"
                                >
                                  <DownloadIcon className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={(e) => handleSolicitarEliminar(e, doc)}
                                  className="text-slate-400 hover:text-red-600 hover:bg-red-50 p-1 rounded transition-colors cursor-pointer"
                                  title="Borrar este PDF"
                                >
                                  <TrashIcon className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          </div>
                        </article>
                      ))
                    ) : (
                      <div className="py-8 flex flex-col items-center justify-center text-center p-4 bg-slate-50/50 rounded-lg border border-dashed border-slate-200 text-slate-400 gap-1.5">
                        <FolderEmptyIcon className="w-7 h-7 text-slate-300" />
                        <p className="text-xs font-medium text-slate-500">Sin escritos presentados</p>
                        <p className="text-[10px] text-slate-400">
                          {puedeSubir ? 'Arrastra un PDF aquí para subir.' : 'Sin documentos en esta sección.'}
                        </p>
                      </div>
                    )}
                  </div>
                </section>
              );
            })}
          </div>
        )}

        {/* MODO B: VISTA DE LISTA DETALLADA */}
        {vistaModo === 'lista' && !seccionIndividual && (
          <div className="bg-white rounded-xl border border-slate-300 shadow-2xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                    <th className="py-3 px-4">Documento</th>
                    <th className="py-3 px-4">Sección Procesal</th>
                    <th className="py-3 px-4">Presentado Por</th>
                    <th className="py-3 px-4">Fecha y Hora</th>
                    <th className="py-3 px-4">Última Anotación</th>
                    <th className="py-3 px-4 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
                  {documentosFiltrados.length > 0 ? (
                    documentosFiltrados.map((doc) => (
                      <tr
                        key={doc.id}
                        onClick={() => setDocSeleccionado(doc)}
                        className="hover:bg-blue-50/40 cursor-pointer transition-colors group"
                      >
                        <td className="py-2.5 px-4 font-medium text-slate-900">
                          <div className="flex items-center gap-2">
                            <FilePdfIcon className="w-4 h-4 text-red-600 shrink-0" />
                            <span className="group-hover:text-blue-700 font-semibold">{doc.titulo}</span>
                          </div>
                        </td>
                        <td className="py-2.5 px-4">
                          <span className="capitalize px-2 py-0.5 rounded text-[11px] font-medium bg-slate-100 text-slate-700">
                            {doc.seccion}
                          </span>
                        </td>
                        <td className="py-2.5 px-4 font-medium text-slate-800">
                          {ROL_LABELS[doc.creado_por] || doc.creado_por}
                        </td>
                        <td className="py-2.5 px-4 text-slate-500">
                          {formatearFechaHora(doc.created_at)}
                        </td>
                        <td className="py-2.5 px-4">
                          {doc.modificado_por ? (
                            <span className="inline-flex items-center gap-1 text-[11px] text-amber-800 bg-amber-50 px-2 py-0.5 rounded border border-amber-200 font-medium">
                              <PenToolIcon className="w-2.5 h-2.5 text-amber-600" />
                              <span>{ROL_LABELS[doc.modificado_por] || doc.modificado_por}</span>
                            </span>
                          ) : (
                            <span className="text-slate-400 text-[11px]">—</span>
                          )}
                        </td>
                        <td className="py-2.5 px-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => setDocSeleccionado(doc)}
                              className="px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded text-xs font-semibold transition-colors cursor-pointer"
                            >
                              Ver / Anotar
                            </button>
                            <button
                              type="button"
                              onClick={(e) => handleCompartirDocumento(e, doc)}
                              className="p-1 hover:bg-blue-100 rounded text-slate-500 hover:text-blue-700 transition-colors cursor-pointer"
                              title="Compartir enlace público"
                            >
                              <ShareIcon className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={(e) => handleDescargarDirecto(e, doc)}
                              className="p-1 hover:bg-slate-200 rounded text-slate-500 transition-colors cursor-pointer"
                              title="Descargar copia"
                            >
                              <DownloadIcon className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={(e) => handleSolicitarEliminar(e, doc)}
                              className="p-1 hover:bg-red-100 rounded text-slate-400 hover:text-red-600 transition-colors cursor-pointer"
                              title="Borrar este PDF"
                            >
                              <TrashIcon className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={6} className="text-center py-10 text-slate-400">
                        No se encontraron documentos coincidentes.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* MODO C: VISTA DE ROL INDIVIDUAL CON PREVIEWS GRANDES */}
        {seccionIndividual && (() => {
          const secConfig = SECCIONES.find((s) => s.key === seccionIndividual)!;
          const docsSeccion = documentosFiltrados.filter((d) => d.seccion === seccionIndividual);
          const puedeSubir = rolActual === seccionIndividual;
          const isDragTarget = seccionDragOver === seccionIndividual;

          // Solo la sección activa tiene borde de color; de lo contrario borde gris neutro estable
          const containerBorder = puedeSubir
            ? secConfig.activeBorder
            : 'border-2 border-slate-300 shadow-2xs';
          const headerBg = puedeSubir
            ? secConfig.activeHeaderBg
            : 'bg-slate-100/80 border-b border-slate-200';
          const iconToRender = puedeSubir ? secConfig.activeIcon : secConfig.inactiveIcon;

          return (
            <div
              onDragOver={(e) => {
                e.preventDefault();
                if (puedeSubir) setSeccionDragOver(seccionIndividual);
              }}
              onDragLeave={() => setSeccionDragOver(null)}
              onDrop={(e) => handleDrop(e, seccionIndividual)}
              className="space-y-6"
            >
              {/* 1. Encabezado principal de la sección individual con navegación y tabs rápidos */}
              <div className={`bg-white rounded-xl ${containerBorder} overflow-hidden transition-all duration-200`}>
                {/* Barra de navegación superior con el único botón de volver */}
                <div className="p-3 bg-white border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
                  <button
                    type="button"
                    onClick={() => setSeccionIndividual(null)}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-red-600 hover:bg-red-700 active:bg-red-800 text-white shadow-md hover:shadow-lg transition-all cursor-pointer ring-2 ring-red-200"
                  >
                    <ArrowLeftIcon className="w-4 h-4 text-white" />
                    <span>Volver al Modo 3 Columnas</span>
                  </button>

                  {/* Selector rápido entre secciones procesales */}
                  <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg border border-slate-200">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider px-2 hidden sm:inline">
                      Sección:
                    </span>
                    {SECCIONES.map((sec) => {
                      const isActual = seccionIndividual === sec.key;
                      const countSec = documentosFiltrados.filter((d) => d.seccion === sec.key).length;
                      return (
                        <button
                          key={sec.key}
                          type="button"
                          onClick={() => setSeccionIndividual(sec.key)}
                          className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                            isActual
                              ? 'bg-white text-slate-900 shadow-2xs font-bold border border-slate-200'
                              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                          }`}
                        >
                          {sec.key === 'autoridad' && <LandmarkIcon className="w-3.5 h-3.5 text-blue-600" />}
                          {sec.key === 'actor' && <UserIcon className="w-3.5 h-3.5 text-emerald-600" />}
                          {sec.key === 'demandado' && <UsersIcon className="w-3.5 h-3.5 text-purple-600" />}
                          <span>{sec.key === 'autoridad' ? 'Autoridad' : sec.key === 'actor' ? 'Actor' : 'Demandado'}</span>
                          <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-200 text-slate-700">
                            {countSec}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Banner de título, descripción y acción de carga */}
                <div className={`p-4 sm:p-6 ${headerBg} flex flex-col md:flex-row md:items-center justify-between gap-4`}>
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-xl bg-white shadow-2xs border border-slate-200 flex items-center justify-center shrink-0 mt-0.5">
                      {iconToRender}
                    </div>
                    <div>
                      <div className="flex items-center gap-2.5 flex-wrap">
                        <h2 className="text-xl font-bold text-slate-900 tracking-tight leading-tight">
                          {secConfig.label}
                        </h2>
                        <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-slate-200/80 text-slate-700 border border-slate-300">
                          {docsSeccion.length} {docsSeccion.length === 1 ? 'escrito' : 'escritos'}
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 mt-1 leading-snug">{secConfig.subtitulo}</p>
                      <div className="mt-2.5 flex items-center gap-2 flex-wrap">
                        {puedeSubir ? (
                          <span className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1 rounded-full bg-emerald-600 text-white shadow-xs">
                            <CheckIcon className="w-3.5 h-3.5" /> Tu Columna Activa • Puedes subir escritos
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1 rounded-full bg-slate-200 text-slate-700 border border-slate-300">
                            <LockIcon className="w-3.5 h-3.5 text-slate-400" /> Modo consulta • Solo lectura para tu rol ({ROL_LABELS[rolActual]})
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Botón de subida si tiene permiso */}
                  <div className="shrink-0">
                    {puedeSubir ? (
                      <label
                        className={`py-2.5 px-4 ${secConfig.btnColor} text-white rounded-lg text-xs font-bold cursor-pointer transition-all shadow-xs flex items-center justify-center gap-2 active:scale-[0.99]`}
                      >
                        <PlusIcon className="w-4 h-4" />
                        <span>{subiendo ? 'Subiendo escrito...' : 'Subir Escrito a esta Sección (PDF)'}</span>
                        <input
                          type="file"
                          accept="application/pdf"
                          className="hidden"
                          disabled={subiendo}
                          onChange={(e) => handleSubirArchivoInput(e, seccionIndividual)}
                        />
                      </label>
                    ) : (
                      <div className="py-2 px-3 bg-white/80 rounded-lg text-xs text-slate-500 font-medium border border-slate-200 flex items-center gap-2">
                        <LockIcon className="w-3.5 h-3.5 text-slate-400" />
                        <span>Solo la parte autorizada puede subir aquí</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* 2. Cuadrícula de documentos con vistas previas grandes */}
              {cargandoLista && documentos.length === 0 ? (
                <div className="py-16 flex flex-col items-center justify-center text-slate-400 gap-3">
                  <div className="w-7 h-7 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                  <span className="text-xs font-medium">Cargando actuaciones procesales...</span>
                </div>
              ) : docsSeccion.length > 0 ? (
                <div
                  className={`grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 ${
                    isDragTarget ? 'ring-2 ring-blue-400 rounded-xl p-2 bg-blue-50/20' : ''
                  }`}
                >
                  {docsSeccion.map((doc) => (
                    <article
                      key={doc.id}
                      onClick={() => setDocSeleccionado(doc)}
                      className="group bg-white rounded-xl border border-slate-200 hover:border-blue-400 hover:shadow-md transition-all duration-200 cursor-pointer flex flex-col overflow-hidden"
                    >
                      {/* Miniatura grande en alta resolución */}
                      <div className="p-3 bg-slate-50/80 border-b border-slate-100 flex items-center justify-center">
                        <PdfThumbnail
                          storagePath={doc.storage_path}
                          titulo={doc.titulo}
                          updatedAt={doc.updated_at}
                          className="w-full h-60 sm:h-64 rounded-lg shadow-2xs"
                          large={true}
                        />
                      </div>

                      {/* Metadatos detallados */}
                      <div className="p-4 flex-1 flex flex-col justify-between">
                        <div>
                          <div className="flex items-start gap-2">
                            <FilePdfIcon className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                            <h3
                              className="text-sm font-bold text-slate-900 group-hover:text-blue-700 transition-colors line-clamp-2 leading-snug"
                              title={doc.titulo}
                            >
                              {doc.titulo}
                            </h3>
                          </div>

                          <div className="mt-2.5 text-xs text-slate-500 space-y-1">
                            <p className="flex items-center gap-1.5 truncate">
                              <UserIcon className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                              <span>Por: <strong className="text-slate-700 font-semibold">{ROL_LABELS[doc.creado_por] || doc.creado_por}</strong></span>
                            </p>
                            <p className="flex items-center gap-1.5 text-slate-400">
                              <ClockIcon className="w-3.5 h-3.5 shrink-0" />
                              <span>{formatearFechaHora(doc.created_at)}</span>
                            </p>
                          </div>

                          {doc.modificado_por && (
                            <div className="mt-2.5 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-1 text-xs text-amber-800 flex items-center gap-1.5 font-medium truncate">
                              <PenToolIcon className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                              <span className="truncate">Notas de {ROL_LABELS[doc.modificado_por] || doc.modificado_por}</span>
                            </div>
                          )}
                        </div>

                        {/* Botones de acción directos */}
                        <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setDocSeleccionado(doc);
                            }}
                            className="flex-1 py-1.5 px-3 bg-blue-50 hover:bg-blue-600 text-blue-700 hover:text-white rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs"
                          >
                            <EyeIcon className="w-3.5 h-3.5" />
                            <span>Ver y Anotar</span>
                          </button>

                          <button
                            type="button"
                            onClick={(e) => handleCompartirDocumento(e, doc)}
                            className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors border border-slate-200 hover:border-blue-200 cursor-pointer"
                            title="Compartir enlace público de este documento"
                          >
                            <ShareIcon className="w-3.5 h-3.5" />
                          </button>

                          <button
                            type="button"
                            onClick={(e) => handleDescargarDirecto(e, doc)}
                            className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors border border-slate-200 cursor-pointer"
                            title="Descargar copia del PDF"
                          >
                            <DownloadIcon className="w-3.5 h-3.5" />
                          </button>

                          <button
                            type="button"
                            onClick={(e) => handleSolicitarEliminar(e, doc)}
                            className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors border border-slate-200 hover:border-red-200 cursor-pointer"
                            title="Borrar este PDF"
                          >
                            <TrashIcon className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    if (puedeSubir) setSeccionDragOver(seccionIndividual);
                  }}
                  onDragLeave={() => setSeccionDragOver(null)}
                  onDrop={(e) => handleDrop(e, seccionIndividual)}
                  className={`py-14 bg-white rounded-xl border border-dashed transition-all text-center flex flex-col items-center justify-center p-6 gap-2.5 ${
                    isDragTarget ? 'border-blue-500 bg-blue-50/40 ring-2 ring-blue-200' : 'border-slate-300'
                  }`}
                >
                  <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 mb-0.5">
                    <FolderEmptyIcon className="w-6 h-6" />
                  </div>
                  <h3 className="text-sm font-bold text-slate-700">Sin escritos presentados en esta sección</h3>
                  <p className="text-xs text-slate-500 max-w-sm leading-relaxed">
                    {puedeSubir
                      ? 'Arrastra un archivo PDF directamente aquí o utiliza el botón superior para subir el primer escrito.'
                      : 'No hay documentos registrados en esta sección procesal.'}
                  </p>
                </div>
              )}
            </div>
          );
        })()}
      </main>

      {/* 4. MODAL DEL VISOR PDF COMPLETO */}
      {docSeleccionado && (
        <PdfViewerModal
          documento={docSeleccionado}
          rolActual={rolActual}
          onClose={() => setDocSeleccionado(null)}
          onUpdated={cargarDocumentos}
          onDeleteRequest={(doc) => handleSolicitarEliminarDesdeVisor(doc)}
        />
      )}

      {/* 5. MODAL DE CONFIRMACIÓN PARA BORRAR PDF */}
      {docAEliminar && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-eliminar-titulo"
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150"
        >
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col">
            {/* Cabecera con advertencia en rojo */}
            <div className="p-5 bg-red-50/80 border-b border-red-100 flex items-start gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-red-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                <TrashIcon className="w-5 h-5" />
              </div>
              <div>
                <h3 id="modal-eliminar-titulo" className="text-base font-bold text-red-950 leading-tight">
                  ¿Borrar documento del expediente?
                </h3>
                <p className="text-xs text-red-700/90 mt-0.5">
                  Esta acción eliminará el archivo PDF y sus anotaciones permanentemente.
                </p>
              </div>
            </div>

            {/* Ficha del escrito a eliminar */}
            <div className="p-5 space-y-3.5 text-xs text-slate-600">
              <p>Estás a punto de borrar definitivamente el siguiente escrito:</p>
              <div className="p-3 bg-slate-100 rounded-lg border border-slate-200 space-y-1">
                <div className="flex items-center gap-1.5 font-bold text-slate-900 text-xs">
                  <FilePdfIcon className="w-4 h-4 text-red-600 shrink-0" />
                  <span className="truncate">{docAEliminar.titulo}</span>
                </div>
                <div className="text-[11px] text-slate-500 flex items-center justify-between pt-1 border-t border-slate-200/70">
                  <span>Sección: <strong className="text-slate-700 capitalize">{docAEliminar.seccion}</strong></span>
                  <span>Presentado por: <strong className="text-slate-700">{ROL_LABELS[docAEliminar.creado_por]}</strong></span>
                </div>
              </div>

              {rolActual === 'autoridad' && docAEliminar.seccion !== 'autoridad' && (
                <div className="p-2.5 bg-blue-50 border border-blue-200 rounded-lg text-[11px] text-blue-900 flex items-center gap-2 font-medium">
                  <LandmarkIcon className="w-4 h-4 text-blue-700 shrink-0" />
                  <span>Eliminando con atribución de Autoridad Judicial.</span>
                </div>
              )}
            </div>

            {/* Acciones de confirmación */}
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2.5">
              <button
                type="button"
                disabled={eliminando}
                onClick={() => setDocAEliminar(null)}
                className="px-4 py-2 bg-white hover:bg-slate-100 text-slate-700 font-semibold text-xs rounded-lg border border-slate-300 transition-colors cursor-pointer shadow-2xs"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={eliminando}
                onClick={confirmarEliminarDocumento}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 active:bg-red-800 text-white font-bold text-xs rounded-lg transition-all flex items-center gap-1.5 cursor-pointer shadow-xs"
              >
                {eliminando ? (
                  <>
                    <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin inline-block" />
                    <span>Borrando...</span>
                  </>
                ) : (
                  <>
                    <TrashIcon className="w-4 h-4" />
                    <span>Borrar Definitivamente</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 6. MODAL DISCRETO DE CAMBIO DE ROL PROCESAL EN ESTE DISPOSITIVO */}
      {modalRolAbierto && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-rol-titulo"
          className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150"
          onClick={() => setModalRolAbierto(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col"
          >
            {/* Cabecera del modal */}
            <div className="p-5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center shrink-0 shadow-2xs">
                  <UserCircleIcon className="w-5 h-5" />
                </div>
                <div>
                  <h3 id="modal-rol-titulo" className="text-sm font-bold text-slate-900 leading-tight">
                    Cambiar Rol Procesal
                  </h3>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Selecciona con qué atribuciones deseas actuar en este equipo
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setModalRolAbierto(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-200/60 transition-colors cursor-pointer"
                title="Cerrar"
              >
                <XIcon className="w-4 h-4" />
              </button>
            </div>

            {/* Contenido del formulario */}
            <form onSubmit={guardarRol} className="p-5 space-y-4 text-xs text-slate-600">
              {/* Selector de Rol */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-2">
                  Rol Procesal Asignado
                </label>
                <div className="space-y-2">
                  {[
                    {
                      key: 'autoridad' as RolProcesal,
                      label: 'Autoridad (Juzgado)',
                      sub: 'Acuerdos, resoluciones y notificaciones judiciales',
                      icon: <LandmarkIcon className="w-4 h-4 text-blue-600" />,
                      borderActive: 'border-blue-600 bg-blue-50/60 ring-2 ring-blue-100',
                    },
                    {
                      key: 'actor' as RolProcesal,
                      label: 'Parte Actora',
                      sub: 'Demandas, anexos y escritos de la parte actora',
                      icon: <UserIcon className="w-4 h-4 text-emerald-600" />,
                      borderActive: 'border-emerald-600 bg-emerald-50/60 ring-2 ring-emerald-100',
                    },
                    {
                      key: 'demandado' as RolProcesal,
                      label: 'Parte Demandada',
                      sub: 'Contestaciones, excepciones y escritos del demandado',
                      icon: <UsersIcon className="w-4 h-4 text-purple-600" />,
                      borderActive: 'border-purple-600 bg-purple-50/60 ring-2 ring-purple-100',
                    },
                  ].map((op) => {
                    const selected = tempRol === op.key;
                    return (
                      <div
                        key={op.key}
                        onClick={() => setTempRol(op.key)}
                        className={`p-3 rounded-xl border text-left cursor-pointer transition-all flex items-center justify-between gap-3 ${
                          selected
                            ? op.borderActive
                            : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-white border border-slate-200 shadow-2xs flex items-center justify-center shrink-0">
                            {op.icon}
                          </div>
                          <div>
                            <div className="text-xs font-bold text-slate-800">
                              {op.label}
                            </div>
                            <div className="text-[11px] text-slate-500 leading-snug">
                              {op.sub}
                            </div>
                          </div>
                        </div>
                        <div
                          className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ${
                            selected ? 'border-blue-600 bg-blue-600' : 'border-slate-300'
                          }`}
                        >
                          {selected && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Acciones y Cerrar Sesión */}
              <div className="pt-3 border-t border-slate-200 flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={handleCerrarSesion}
                  className="inline-flex items-center gap-1.5 text-xs text-red-600 hover:text-red-700 font-semibold px-2.5 py-1.5 rounded-lg hover:bg-red-50 transition-colors cursor-pointer"
                  title="Cerrar sesión en este equipo"
                >
                  <LogOutIcon className="w-3.5 h-3.5" />
                  <span>Cerrar Sesión</span>
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setModalRolAbierto(false)}
                    className="px-3.5 py-1.5 rounded-xl border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-xs font-bold transition-all shadow-sm cursor-pointer"
                  >
                    Guardar Rol
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 7. MODAL PARA COMPARTIR DOCUMENTO MEDIANTE ENLACE PÚBLICO */}
      {docACompartir && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-compartir-titulo"
          className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150"
          onClick={() => setDocACompartir(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col"
          >
            {/* Cabecera */}
            <div className="p-5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center shrink-0 shadow-2xs">
                  <ShareIcon className="w-5 h-5" />
                </div>
                <div>
                  <h3 id="modal-compartir-titulo" className="text-sm font-bold text-slate-900 leading-tight">
                    Compartir Escrito
                  </h3>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Enlace de consulta pública de solo lectura
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setDocACompartir(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-200/60 transition-colors cursor-pointer"
                title="Cerrar"
              >
                <XIcon className="w-4 h-4" />
              </button>
            </div>

            {/* Ficha del escrito */}
            <div className="p-5 space-y-4 text-xs text-slate-600">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1.5">
                <div className="flex items-center gap-2 font-bold text-slate-900 text-xs">
                  <FilePdfIcon className="w-4 h-4 text-red-600 shrink-0" />
                  <span className="truncate">{docACompartir.titulo}</span>
                </div>
                <div className="text-[11px] text-slate-500 flex items-center justify-between pt-1 border-t border-slate-200/70">
                  <span>Sección: <strong className="text-slate-700 capitalize">{docACompartir.seccion}</strong></span>
                  <span>Presentado por: <strong className="text-slate-700">{ROL_LABELS[docACompartir.creado_por]}</strong></span>
                </div>
              </div>

              {/* Caja con el enlace y botón de copiar */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Enlace de Consulta Pública
                </label>
                <div className="flex items-center gap-1.5 p-1.5 bg-slate-100 rounded-xl border border-slate-300">
                  <input
                    type="text"
                    readOnly
                    value={typeof window !== 'undefined' ? `${window.location.origin}/ver/${docACompartir.id}` : ''}
                    className="flex-1 px-2.5 py-1 text-xs text-slate-800 bg-transparent border-none outline-hidden select-all font-mono"
                  />
                  <button
                    type="button"
                    onClick={async () => {
                      if (typeof window !== 'undefined') {
                        try {
                          await navigator.clipboard.writeText(`${window.location.origin}/ver/${docACompartir.id}`);
                          setEnlaceCopiado(true);
                        } catch {
                          // ignore
                        }
                      }
                    }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs ${
                      enlaceCopiado
                        ? 'bg-emerald-600 text-white'
                        : 'bg-blue-600 hover:bg-blue-700 text-white'
                    }`}
                  >
                    {enlaceCopiado ? (
                      <>
                        <CheckIcon className="w-3.5 h-3.5" />
                        <span>¡Copiado!</span>
                      </>
                    ) : (
                      <>
                        <CopyIcon className="w-3.5 h-3.5" />
                        <span>Copiar</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-blue-50/70 border border-blue-200/80 text-[11px] text-blue-900 leading-relaxed">
                Quien reciba este enlace podrá <strong>visualizar y descargar únicamente este escrito</strong> en el visor oficial, sin necesidad de ingresar la contraseña del tribunal ni tener acceso al resto del expediente.
              </div>

              {/* Botones complementarios */}
              <div className="pt-2 flex flex-wrap items-center gap-2">
                <a
                  href={`https://api.whatsapp.com/send?text=${encodeURIComponent(
                    `Adjunto documento del expediente judicial electrónico (${docACompartir.titulo}): ${
                      typeof window !== 'undefined' ? `${window.location.origin}/ver/${docACompartir.id}` : ''
                    }`
                  )}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 py-2 px-3 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 text-xs font-semibold text-center transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <span>Enviar por WhatsApp</span>
                </a>

                <a
                  href={typeof window !== 'undefined' ? `/ver/${docACompartir.id}` : '#'}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="py-2 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-colors cursor-pointer"
                >
                  Abrir vista
                </a>
              </div>
            </div>

            {/* Footer */}
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end">
              <button
                type="button"
                onClick={() => setDocACompartir(null)}
                className="px-4 py-2 bg-white hover:bg-slate-100 text-slate-700 font-semibold text-xs rounded-xl border border-slate-300 transition-colors cursor-pointer shadow-2xs"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
