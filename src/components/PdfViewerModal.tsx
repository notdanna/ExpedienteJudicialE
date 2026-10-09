'use client';
import React, { useRef, useState, useEffect, useCallback } from 'react';
import { supabase, DocumentoProcesal, RolProcesal } from '../lib/supabase';
import { FilePdfIcon, DownloadIcon, CloudUploadIcon, XIcon, TrashIcon, ShareIcon, CheckIcon } from './Icons';

interface PDFDocumentProxyWithSave {
  saveDocument?: (printToPDF?: unknown) => Promise<Uint8Array>;
  getData?: () => Promise<Uint8Array>;
}

interface PDFViewerApplicationType {
  pdfDocument?: PDFDocumentProxyWithSave;
  saveDocument?: () => Promise<Uint8Array>;
}

interface PDFViewerWindow extends Window {
  PDFViewerApplication?: PDFViewerApplicationType;
}

interface PdfViewerModalProps {
  documento: DocumentoProcesal;
  rolActual: RolProcesal;
  onClose: () => void;
  onUpdated: () => void;
  onDeleteRequest?: (doc: DocumentoProcesal) => void;
}

export const PdfViewerModal: React.FC<PdfViewerModalProps> = ({
  documento,
  rolActual,
  onClose,
  onUpdated,
  onDeleteRequest,
}) => {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [copiadoCompartir, setCopiadoCompartir] = useState(false);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  const handleCompartir = async () => {
    try {
      const url = `${window.location.origin}/ver/${documento.id}`;
      await navigator.clipboard.writeText(url);
      setCopiadoCompartir(true);
      setTimeout(() => setCopiadoCompartir(false), 2500);
    } catch {
      // Fallback
    }
  };

  useEffect(() => {
    let activo = true;
    let urlGenerada = '';

    const descargarArchivo = async () => {
      try {
        const { data, error } = await supabase.storage
          .from('expedientes-pdf')
          .download(documento.storage_path);

        if (error) throw error;
        if (!data) throw new Error('No se recibieron datos del archivo');

        urlGenerada = URL.createObjectURL(data);
        if (activo) {
          setBlobUrl(urlGenerada);
          setCargando(false);
        }
      } catch (err: unknown) {
        console.error(err);
        const mensaje = err instanceof Error ? err.message : 'Error desconocido';
        alert(`Error al abrir documento: ${mensaje}`);
        onCloseRef.current();
      }
    };

    descargarArchivo();

    return () => {
      activo = false;
      if (urlGenerada) {
        URL.revokeObjectURL(urlGenerada);
      }
    };
  }, [documento.storage_path]);

  // Manejar tecla Escape para cerrar
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !guardando) {
        onCloseRef.current();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [guardando]);

  const obtenerPdfAnotadoBytes = useCallback(async (): Promise<Uint8Array | null> => {
    try {
      const iframeWindow = iframeRef.current?.contentWindow as PDFViewerWindow | null;
      const app = iframeWindow?.PDFViewerApplication;

      if (!app || !app.pdfDocument) {
        throw new Error('El visor PDF aún se está cargando. Espera un momento antes de guardar.');
      }

      // La API oficial de Mozilla PDF.js expone saveDocument en app.pdfDocument
      if (typeof app.pdfDocument.saveDocument === 'function') {
        return await app.pdfDocument.saveDocument();
      }

      // Alternativa con getData si no hubo anotaciones nuevas
      if (typeof app.pdfDocument.getData === 'function') {
        return await app.pdfDocument.getData();
      }

      if (typeof app.saveDocument === 'function') {
        return await app.saveDocument();
      }

      throw new Error('No se encontró el método de serialización en el visor PDF.');
    } catch (err: unknown) {
      console.error(err);
      const mensaje = err instanceof Error ? err.message : 'Error al capturar el archivo editado';
      alert(mensaje);
      return null;
    }
  }, []);

  const handleDescargar = async () => {
    const bytes = await obtenerPdfAnotadoBytes();
    if (!bytes) return;

    const blob = new Blob([bytes as unknown as BlobPart], { type: 'application/pdf' });
    const downloadUrl = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = `${documento.titulo}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(downloadUrl);
  };

  const handleGuardarEnNube = async () => {
    setGuardando(true);
    try {
      const bytes = await obtenerPdfAnotadoBytes();
      if (!bytes) {
        setGuardando(false);
        return;
      }

      const blob = new Blob([bytes as unknown as BlobPart], { type: 'application/pdf' });

      // Upsert a storage con cacheControl: 0 para evitar que el navegador o CDN sirvan la versión desactualizada
      const { error: uploadError } = await supabase.storage
        .from('expedientes-pdf')
        .upload(documento.storage_path, blob, {
          upsert: true,
          contentType: 'application/pdf',
          cacheControl: '0',
        });

      if (uploadError) throw uploadError;

      // Actualizar registro en base de datos con el rol y la hora exacta
      const { error: dbError } = await supabase
        .from('documentos')
        .update({
          modificado_por: rolActual,
          updated_at: new Date().toISOString(),
        })
        .eq('id', documento.id);

      if (dbError) throw dbError;

      alert('Documento y resaltados guardados con éxito en la nube.');
      onUpdated();
      onClose();
    } catch (err: unknown) {
      const mensaje = err instanceof Error ? err.message : 'Error al guardar';
      alert(`Error al guardar en la nube: ${mensaje}`);
    } finally {
      setGuardando(false);
    }
  };

  const viewerUrl = blobUrl ? `/pdfjs/web/viewer.html?file=${encodeURIComponent(blobUrl)}` : '';

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="pdf-viewer-title"
      className="fixed inset-0 z-50 bg-black/90 backdrop-blur-sm flex flex-col animate-in fade-in duration-200"
    >
      <header className="bg-slate-900/95 border-b border-slate-800 px-4 md:px-6 py-3 flex flex-wrap justify-between items-center text-white gap-3 shadow-lg">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-red-600/20 border border-red-500/30 text-red-400 flex items-center justify-center shrink-0">
            <FilePdfIcon className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <h3 id="pdf-viewer-title" className="font-bold text-sm truncate max-w-xs md:max-w-md text-slate-100">
              {documento.titulo}
            </h3>
            <div className="flex items-center gap-2 text-[11px] text-slate-400 mt-0.5">
              <span>Sección:</span>
              <span className="uppercase text-slate-300 font-semibold px-1.5 py-0.2 rounded bg-slate-800 border border-slate-700">
                {documento.seccion}
              </span>
              <span className="hidden sm:inline text-slate-500">• ESC para cerrar</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 md:gap-2.5">
          {onDeleteRequest && (
            <button
              onClick={() => onDeleteRequest(documento)}
              disabled={cargando || guardando}
              className="px-3 py-1.5 bg-slate-800 hover:bg-red-950/60 hover:text-red-300 border border-slate-700 hover:border-red-500/50 text-slate-300 rounded-lg text-xs font-medium transition-all disabled:opacity-50 cursor-pointer flex items-center gap-1.5 shadow-2xs"
              title="Eliminar este escrito definitivamente"
            >
              <TrashIcon className="w-3.5 h-3.5 text-red-400" />
              <span className="hidden sm:inline">Borrar</span>
            </button>
          )}

          <button
            onClick={handleCompartir}
            disabled={cargando || guardando}
            className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 rounded-lg text-xs font-medium transition-all disabled:opacity-50 cursor-pointer flex items-center gap-1.5 shadow-2xs"
            title="Copiar enlace de consulta pública para este documento"
          >
            {copiadoCompartir ? (
              <>
                <CheckIcon className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-emerald-300">¡Copiado!</span>
              </>
            ) : (
              <>
                <ShareIcon className="w-3.5 h-3.5 text-slate-300" />
                <span className="hidden sm:inline">Compartir</span>
              </>
            )}
          </button>

          <button
            onClick={handleDescargar}
            disabled={cargando || guardando}
            className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 rounded-lg text-xs font-medium transition-all disabled:opacity-50 cursor-pointer flex items-center gap-1.5 shadow-2xs"
            title="Descargar PDF con anotaciones a tu equipo"
          >
            <DownloadIcon className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Descargar copia</span>
          </button>

          <button
            onClick={handleGuardarEnNube}
            disabled={guardando || cargando}
            className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white rounded-lg text-xs font-semibold disabled:opacity-50 transition-all cursor-pointer flex items-center gap-1.5 shadow-md hover:shadow-lg"
            title="Guardar notas y resaltados para todas las partes"
          >
            {guardando ? (
              <>
                <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin inline-block" />
                <span>Guardando...</span>
              </>
            ) : (
              <>
                <CloudUploadIcon className="w-4 h-4" />
                <span>Guardar en la nube</span>
              </>
            )}
          </button>

          <button
            onClick={onClose}
            disabled={guardando}
            className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-red-600/90 hover:text-white text-slate-400 transition-colors flex items-center justify-center cursor-pointer border border-slate-700/60"
            title="Cerrar visor (ESC)"
            aria-label="Cerrar visor"
          >
            <XIcon className="w-4 h-4" />
          </button>
        </div>
      </header>

      {cargando ? (
        <div className="flex-1 flex flex-col items-center justify-center text-slate-300 gap-3">
          <div className="w-10 h-10 border-3 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm font-medium">Cargando documento judicial...</p>
          <span className="text-xs text-slate-500">Preparando motor de anotaciones y visor PDF.js</span>
        </div>
      ) : (
        <iframe
          ref={iframeRef}
          src={viewerUrl}
          className="w-full flex-1 border-none bg-slate-900"
          title={`Visor PDF - ${documento.titulo}`}
        />
      )}
    </div>
  );
};
