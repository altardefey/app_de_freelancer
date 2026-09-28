import "react-native-url-polyfill/auto";
import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabasePublicKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
if (!supabaseUrl?.startsWith("https://") || !supabasePublicKey?.startsWith("sb_publishable_")) {
  throw new Error("Configure a URL HTTPS e a chave pública do Supabase.");
}
const secureStorage = {
  async getItem(key: string) {
    // apaga a sessão antiga que ficava sem criptografia no aparelho
    await AsyncStorage.removeItem(key);
    const count = Number(await SecureStore.getItemAsync(`${key}.count`));
    if (!Number.isInteger(count) || count < 1 || count > 64) return null;
    const pieces = await Promise.all(Array.from({ length: count }, (_, i) => SecureStore.getItemAsync(`${key}.${i}`)));
    return pieces.some(piece => piece === null) ? null : pieces.join("");
  },
  async setItem(key: string, value: string) {
    // divide a sessão pra não estourar o tamanho de cada item no keychain
    const count = Math.ceil(value.length / 500);
    if (count > 64) throw new Error("Sessão muito grande para salvar com segurança.");
    for (let i = 0; i < count; i++) await SecureStore.setItemAsync(`${key}.${i}`, value.slice(i * 500, (i + 1) * 500), { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY });
    await SecureStore.setItemAsync(`${key}.count`, String(count));
  },
  async removeItem(key: string) {
    await AsyncStorage.removeItem(key);
    await SecureStore.deleteItemAsync(`${key}.count`);
    await Promise.all(Array.from({ length: 64 }, (_, i) => SecureStore.deleteItemAsync(`${key}.${i}`)));
  },
};
// no navegador os tokens ficam só nos cookies httponly do servidor
export const supabase = createClient(supabaseUrl, supabasePublicKey, {
  auth: {
    ...(Platform.OS !== "web" ? { storage: secureStorage } : {}),
    autoRefreshToken: Platform.OS !== "web", persistSession: Platform.OS !== "web", detectSessionInUrl: false,
  },
});
if (Platform.OS === "web" && typeof window !== "undefined") {
  try { window.localStorage.removeItem(`sb-${new URL(supabaseUrl).hostname.split(".")[0]}-auth-token`); } catch { /* o navegador pode bloquear o storage */ }
}
