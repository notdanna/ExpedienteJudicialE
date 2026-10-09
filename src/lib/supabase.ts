import { createClient } from '@supabase/supabase-js';

export type SeccionProcesal = 'autoridad' | 'actor' | 'demandado';
export type RolProcesal = 'autoridad' | 'actor' | 'demandado';

export interface DocumentoProcesal {
  id: string;
  seccion: SeccionProcesal;
  titulo: string;
  storage_path: string;
  creado_por: RolProcesal;
  modificado_por: RolProcesal | null;
  created_at: string;
  updated_at: string;
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    'ADVERTENCIA: Variables de entorno de Supabase no configuradas. Verifica NEXT_PUBLIC_SUPABASE_URL y NEXT_PUBLIC_SUPABASE_ANON_KEY.'
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
