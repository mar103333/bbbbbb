import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://unrifriyeimwibubtmgc.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_JxZ5X3gAWwIPnJzNAc1GAA_LNlZG9b2';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
