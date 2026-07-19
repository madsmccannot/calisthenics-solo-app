// Cliente Supabase. Só fica ativo se as chaves estiverem no .env
// (EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY). Sem chaves, a app
// funciona em modo local (offline, sem contas) como antes — bom fallback de dev.

import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

export const supabaseEnabled = !!(url && anonKey);

export const supabase = supabaseEnabled
  ? createClient(url, anonKey, {
      auth: {
        storage: AsyncStorage, // sessão persistida no dispositivo (permite offline)
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false, // não é web
      },
    })
  : null;
