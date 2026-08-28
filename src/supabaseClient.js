import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error(
    "Faltam as variáveis VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY. Configure-as no Vercel (Settings > Environment Variables) ou em um arquivo .env.local para testar localmente."
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
