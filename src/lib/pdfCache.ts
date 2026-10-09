import { supabase } from './supabase';

// Cache centralizado en memoria para Blobs descargados (storagePath -> Blob)
const pdfBlobCache = new Map<string, Blob>();

// Registro de promesas en curso para evitar peticiones duplicadas simultáneas
const inFlightRequests = new Map<string, Promise<Blob>>();

/**
 * Obtiene el archivo PDF de un documento procesal.
 * Si ya fue descargado previamente (por ejemplo, para generar la miniatura de la tarjeta),
 * lo devuelve inmediatamente de la memoria RAM (0 ms).
 * Si hay una descarga en curso, reutiliza esa misma conexión.
 * Incluye control de tiempo límite (timeout) y reintento automático.
 */
export async function obtenerPdfBlob(storagePath: string, forzarRecarga = false): Promise<Blob> {
  if (!forzarRecarga && pdfBlobCache.has(storagePath)) {
    return pdfBlobCache.get(storagePath)!;
  }

  // Si ya se está descargando este mismo archivo, esperar la misma promesa
  const peticionExistente = inFlightRequests.get(storagePath);
  if (peticionExistente && !forzarRecarga) {
    return peticionExistente;
  }

  const promise = (async () => {
    try {
      const blob = await descargarConTimeout(storagePath, 15000);
      pdfBlobCache.set(storagePath, blob);
      return blob;
    } catch (err: unknown) {
      console.warn(`Primer intento de descarga falló para ${storagePath}, reintentando...`, err);
      try {
        const blob = await descargarConTimeout(storagePath, 20000);
        pdfBlobCache.set(storagePath, blob);
        return blob;
      } catch (retryErr: unknown) {
        throw retryErr;
      }
    } finally {
      inFlightRequests.delete(storagePath);
    }
  })();

  inFlightRequests.set(storagePath, promise);
  return promise;
}

async function descargarConTimeout(storagePath: string, timeoutMs: number): Promise<Blob> {
  const controller = new AbortController();
  const timer = setTimeout(() => {
    controller.abort();
  }, timeoutMs);

  try {
    const { data, error } = await supabase.storage
      .from('expedientes-pdf')
      .download(storagePath, {}, { signal: controller.signal });

    if (error) throw error;
    if (!data) throw new Error('No se recibieron datos del archivo desde el servidor');

    return data;
  } catch (err: unknown) {
    if (err instanceof Error && (err.name === 'AbortError' || err.message.includes('aborted'))) {
      throw new Error('La descarga del archivo PDF excedió el tiempo límite. Verifica tu conexión de red.');
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Guarda o actualiza un Blob en cache (por ejemplo, tras anotar y guardar en nube).
 */
export function guardarEnPdfCache(storagePath: string, blob: Blob) {
  pdfBlobCache.set(storagePath, blob);
}

/**
 * Invalida el cache en memoria para una ruta específica.
 */
export function invalidarPdfCache(storagePath: string) {
  pdfBlobCache.delete(storagePath);
  inFlightRequests.delete(storagePath);
}
