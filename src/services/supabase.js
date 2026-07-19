// Supabase client. Only active if the keys are in .env
// (EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY). Without keys, the app
// runs in local mode (offline, no accounts) as before — a good dev fallback.

import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

export const supabaseEnabled = !!(url && anonKey);

export const supabase = supabaseEnabled
  ? createClient(url, anonKey, {
      auth: {
        storage: AsyncStorage, // session persisted on the device (allows offline)
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false, // not web
      },
    })
  : null;
