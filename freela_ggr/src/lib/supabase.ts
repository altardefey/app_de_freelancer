import "react-native-url-polyfill/auto";

import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl =
  process.env.EXPO_PUBLIC_SUPABASE_URL ??
  "https://yckfxydpokyvizvbjout.supabase.co";

// chave pública do aplicativo, pode ser definida pela variável de ambiente
const supabasePublicKey =
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ??
  "sb_publishable_ETA_Jjo0W-yCYpPoVDlu2w_XzEvYQ2V";

// no servidor web não tem storage real, então fica um fallback vazio
const memoryStorage = {
  getItem: async () => null,
  setItem: async () => undefined,
  removeItem: async () => undefined,
};

const authStorage =
  typeof window === "undefined" ? memoryStorage : AsyncStorage;

export const supabase = createClient(supabaseUrl, supabasePublicKey, {
  auth: {
    storage: authStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
