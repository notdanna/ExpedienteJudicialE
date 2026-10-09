'use client';
import React, { useEffect, useState, use, Suspense } from 'react';
import Link from 'next/link';
import { supabase, DocumentoProcesal, RolProcesal } from '@/lib/supabase';
import { obtenerPdfBlob } from '@/lib/pdfCache';
import {
  ScaleIcon,
  FilePdfIcon,
  DownloadIcon,
  CopyIcon,
  CheckIcon,
  LandmarkIcon,
  UserIcon,
  UsersIcon,
  ClockIcon,
  ArrowLeftIcon,
} from '@/components/Icons';

const ROL_LABELS: Record<RolProcesal, string> = {
  autoridad: 'Autoridad (Juzgado)',
  actor: 'Parte Actora',
  demandado: 'Parte Demandada',
};

function formatearFecha(fechaIso: string): string {
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

function DocumentoCompartidoInner({
  paramsPromise,
}: {
  paramsPromise: Promise<{ id: string }>;
}) {
  const { id } = use(paramsPromise);
  const [documento, setDocumento] = useState<DocumentoProcesal | null>(null);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [cargando, setCargando] = useState(true);
  const [errorMensaje, setErrorMensaje] = useState<string | null>(null);
  const [copiado, setCopiado] = useState(false);

  useEffect(() => {
    let activo = true;
    let urlGenerada = '';

    async function cargarDoc() {
      try {
        setCargando(true);
        setErrorMensaje(null);

        // 1. Consultar metadatos en base de datos
        const { data: docData, error: dbError } = await supabase
          .from('documentos')
          .select('*')
          .eq('id', id)
          .single();

        if (dbError || !docData) {
          throw new Error('El documento no fue encontrado o no está disponible.');
        }

        if (!activo) return;
        setDocumento(docData as DocumentoProcesal);

        // 2. Descargar archivo del storage con timeout y reintento
        const fileData = await obtenerPdfBlob(docData.storage_path);

        if (!activo) return;
        urlGenerada = URL.createObjectURL(fileData);
        setBlobUrl(urlGenerada);
      } catch (err: unknown) {
        if (!activo) return;
        const msg = err instanceof Error ? err.message : 'Error al cargar el documento';
        setErrorMensaje(msg);
      } finally {
        if (activo) {
          setCargando(false);
        }
      }
    }

    cargarDoc();

    return () => {
      activo = false;
      if (urlGenerada) {
        URL.revokeObjectURL(urlGenerada);
      }
    };
  }, [id]);

  const handleDescargar = () => {
    if (!blobUrl || !documento) return;
    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = `${documento.titulo}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleCopiarEnlace = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2500);
    } catch {
      // Fallback
    }
  };

  if (cargando) {
    return (
      <div className="min-h-screen bg-slate-100 flex flex-col items-center justify-center p-4">
        <div className="bg-white p-8 rounded-2xl shadow-md border border-slate-200 flex flex-col items-center max-w-sm w-full text-center">
          <div className="w-12 h-12 rounded-xl bg-blue-50 border border-blue-200 text-blue-600 flex items-center justify-center mb-4">
            <ScaleIcon className="w-6 h-6 animate-pulse" />
          </div>
          <h2 className="text-sm font-bold text-slate-800">Cargando documento...</h2>
          <p className="text-xs text-slate-500 mt-1">Conectando con el expediente judicial electrónico</p>
        </div>
      </div>
    );
  }

  if (errorMensaje || !documento) {
    return (
      <div className="min-h-screen bg-slate-100 flex flex-col items-center justify-center p-4">
        <div className="bg-white p-8 rounded-2xl shadow-md border border-slate-200 flex flex-col items-center max-w-md w-full text-center">
          <div className="w-12 h-12 rounded-xl bg-red-50 border border-red-200 text-red-600 flex items-center justify-center mb-4">
            <FilePdfIcon className="w-6 h-6" />
          </div>
          <h2 className="text-base font-bold text-slate-900">Documento no disponible</h2>
          <p className="text-xs text-slate-500 mt-2 leading-relaxed">
            {errorMensaje || 'El enlace es inválido o el documento fue retirado del expediente.'}
          </p>
          <Link
            href="/"
            className="mt-6 inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs"
          >
            <ArrowLeftIcon className="w-3.5 h-3.5" />
            <span>Ir al Expediente Digital</span>
          </Link>
        </div>
      </div>
    );
  }

  const viewerUrl = blobUrl ? `/pdfjs/web/viewer.html?file=${encodeURIComponent(blobUrl)}` : '';

  return (
    <div className="h-screen flex flex-col bg-slate-100">
      {/* Barra superior de información del escrito compartido */}
      <header className="bg-white border-b border-slate-200 px-4 py-2.5 shadow-2xs z-10 shrink-0">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
          {/* Identificador institucional y título */}
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-blue-50 border border-blue-200 text-blue-700 flex items-center justify-center shrink-0">
              <ScaleIcon className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-blue-100 text-blue-800">
                  Documento Compartido
                </span>
                <span className="text-[11px] font-semibold text-slate-500 flex items-center gap-1">
                  {documento.seccion === 'autoridad' && <LandmarkIcon className="w-3 h-3 text-blue-600" />}
                  {documento.seccion === 'actor' && <UserIcon className="w-3 h-3 text-emerald-600" />}
                  {documento.seccion === 'demandado' && <UsersIcon className="w-3 h-3 text-purple-600" />}
                  <span>{ROL_LABELS[documento.seccion]}</span>
                </span>
              </div>
              <h1 className="text-sm font-bold text-slate-900 truncate mt-0.5" title={documento.titulo}>
                {documento.titulo}
              </h1>
            </div>
          </div>

          {/* Acciones: Descargar, Copiar enlace y Acceder al expediente */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleCopiarEnlace}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold shadow-2xs transition-colors cursor-pointer"
              title="Copiar enlace de este documento"
            >
              {copiado ? (
                <>
                  <CheckIcon className="w-3.5 h-3.5 text-emerald-600" />
                  <span className="text-emerald-700">¡Copiado!</span>
                </>
              ) : (
                <>
                  <CopyIcon className="w-3.5 h-3.5 text-slate-500" />
                  <span>Copiar Enlace</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={handleDescargar}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-xs transition-colors cursor-pointer"
              title="Descargar copia del archivo PDF"
            >
              <DownloadIcon className="w-3.5 h-3.5" />
              <span>Descargar PDF</span>
            </button>

            <div className="h-4 w-px bg-slate-200 hidden sm:block" />

            <Link
              href="/"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-600 hover:text-slate-900 text-xs font-medium transition-colors"
              title="Ir al portal privado del expediente completo"
            >
              <span>Expediente Completo</span>
            </Link>
          </div>
        </div>

        {/* Sub-información del documento */}
        <div className="max-w-7xl mx-auto flex items-center gap-3 text-[11px] text-slate-500 mt-1 pt-1 border-t border-slate-100">
          <span className="flex items-center gap-1">
            <ClockIcon className="w-3 h-3 text-slate-400" />
            <span>Fecha de actuación: {formatearFecha(documento.created_at)}</span>
          </span>
          <span>•</span>
          <span>Presentado por: <strong className="text-slate-700">{ROL_LABELS[documento.creado_por]}</strong></span>
          {documento.modificado_por && (
            <>
              <span>•</span>
              <span className="text-amber-700 font-medium">Contiene notas de {ROL_LABELS[documento.modificado_por]}</span>
            </>
          )}
        </div>
      </header>

      {/* Visor PDF integrado a pantalla completa */}
      <main className="flex-1 bg-slate-200 relative overflow-hidden">
        {viewerUrl ? (
          <iframe
            src={viewerUrl}
            title={documento.titulo}
            className="w-full h-full border-none"
            allow="fullscreen"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-slate-400 text-xs">
            Preparando visor de lectura...
          </div>
        )}
      </main>
    </div>
  );
}

export default function DocumentoCompartidoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-100 flex flex-col items-center justify-center p-4">
          <div className="bg-white p-8 rounded-2xl shadow-md border border-slate-200 flex flex-col items-center max-w-sm w-full text-center">
            <div className="w-12 h-12 rounded-xl bg-blue-50 border border-blue-200 text-blue-600 flex items-center justify-center mb-4">
              <ScaleIcon className="w-6 h-6 animate-pulse" />
            </div>
            <h2 className="text-sm font-bold text-slate-800">Cargando documento...</h2>
            <p className="text-xs text-slate-500 mt-1">Conectando con el expediente judicial electrónico</p>
          </div>
        </div>
      }
    >
      <DocumentoCompartidoInner paramsPromise={params} />
    </Suspense>
  );
}
