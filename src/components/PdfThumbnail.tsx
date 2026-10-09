'use client';
import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { FilePdfIcon, SearchIcon } from './Icons';

// Cache global en memoria para miniaturas ya generadas (evita volver a descargar)
const thumbnailCache = new Map<string, string>();

interface PdfThumbnailProps {
  storagePath: string;
  titulo: string;
  className?: string;
  large?: boolean;
}

export const PdfThumbnail: React.FC<PdfThumbnailProps> = ({
  storagePath,
  titulo,
  className = 'w-20 h-26',
  large = false,
}) => {
  const cacheKey = large ? `${storagePath}-large` : storagePath;
  const [thumbUrl, setThumbUrl] = useState<string | null>(() => thumbnailCache.get(cacheKey) || null);
  const [cargando, setCargando] = useState(() => !thumbnailCache.has(cacheKey));

  useEffect(() => {
    if (thumbnailCache.has(cacheKey)) {
      return;
    }

    let activo = true;

    async function generarMiniatura() {
      try {
        // 1. Descargar datos del archivo desde Supabase Storage
        const { data, error: downloadError } = await supabase.storage
          .from('expedientes-pdf')
          .download(storagePath);

        if (downloadError || !data) {
          throw downloadError || new Error('No se descargó el PDF');
        }

        const arrayBuffer = await data.arrayBuffer();

        // 2. Cargar dinámicamente PDF.js en el cliente desde la ruta estática
        // @ts-expect-error Carga dinámica en tiempo de ejecución desde public/
        const pdfjsLib = await import(/* webpackIgnore: true */ '/pdfjs/build/pdf.mjs');
        if (pdfjsLib.GlobalWorkerOptions) {
          pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdfjs/build/pdf.worker.mjs';
        }

        const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) });
        const pdf = await loadingTask.promise;
        const page = await pdf.getPage(1);

        // Escalar miniatura: 400px de ancho si es vista grande, 160px si es compacta
        const targetWidth = large ? 400 : 160;
        const unscaledViewport = page.getViewport({ scale: 1 });
        const scale = targetWidth / unscaledViewport.width;
        const viewport = page.getViewport({ scale });

        const canvas = document.createElement('canvas');
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        const ctx = canvas.getContext('2d');

        if (!ctx) throw new Error('No se pudo obtener el contexto 2d del canvas');

        const renderContext = {
          canvasContext: ctx,
          viewport: viewport,
        };

        await page.render(renderContext).promise;

        if (!activo) return;

        const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
        thumbnailCache.set(cacheKey, dataUrl);
        setThumbUrl(dataUrl);
      } catch (err) {
        if (!activo) return;
        console.warn('No se pudo renderizar la miniatura PDF:', err);
      } finally {
        if (activo) {
          setCargando(false);
        }
      }
    }

    generarMiniatura();

    return () => {
      activo = false;
    };
  }, [storagePath, cacheKey, large]);

  return (
    <div
      className={`relative shrink-0 rounded-md overflow-hidden bg-slate-100 border border-slate-200/90 shadow-2xs select-none flex items-center justify-center ${className}`}
    >
      {thumbUrl ? (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img
          src={thumbUrl}
          alt={`Vista previa de ${titulo}`}
          className="w-full h-full object-cover object-top transition-transform duration-200 group-hover:scale-105"
          loading="lazy"
        />
      ) : (
        /* Vista de hoja legal compacta mientras carga o en fallback */
        <div className="w-full h-full p-3 flex flex-col justify-between bg-white text-slate-400">
          <div className="flex items-center justify-between">
            <FilePdfIcon className={`${large ? 'w-5 h-5' : 'w-3.5 h-3.5'} text-red-500 shrink-0`} />
            <span className="text-[9px] font-bold tracking-tight text-red-700 bg-red-50 px-1.5 py-0.5 rounded">
              PDF
            </span>
          </div>

          <div className="space-y-1.5 my-auto px-1">
            <div className="h-1.5 bg-slate-200 rounded w-full animate-pulse" />
            <div className="h-1.5 bg-slate-200 rounded w-5/6 animate-pulse" />
            <div className="h-1.5 bg-slate-200 rounded w-4/6 animate-pulse" />
            {large && <div className="h-1.5 bg-slate-200 rounded w-3/4 animate-pulse" />}
          </div>

          <div className="text-[9px] font-mono text-slate-400 text-center border-t border-slate-100 pt-1">
            {cargando ? 'Generando preview...' : 'Pág. 1'}
          </div>
        </div>
      )}

      {/* Overlay al pasar el mouse */}
      <div className="absolute inset-0 bg-slate-900/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
        <span className="w-7 h-7 rounded-full bg-slate-900/80 text-white flex items-center justify-center shadow-md">
          <SearchIcon className="w-3.5 h-3.5" />
        </span>
      </div>
    </div>
  );
};
