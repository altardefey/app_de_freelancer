import { Platform } from "react-native";
import { supabase } from "./supabase";
import { webApi, type ApiError } from "./webApi";

export type AppUser = { id: string; email?: string; identities?: unknown[] };
type AuthData = { user: AppUser | null; session?: { user: AppUser } | null };
type Credentials = { email: string; password: string; options?: { captchaToken?: string; data?: Record<string, unknown> } };
const listeners = new Set<(event: string, session: { user: AppUser } | null) => void>();
async function webAuth(action: string, payload = {}): Promise<{ data: AuthData; error: ApiError | null }> {
  try {
    const data = await webApi<AuthData>(action, payload);
    if (["login", "signup", "logout"].includes(action)) {
      const session = data.session ?? null;
      listeners.forEach(listener => listener(action, session));
      // as outras abas descartam o estado da conta antiga também
      if (typeof BroadcastChannel !== "undefined") {
        const channel = new BroadcastChannel("auth-changed");
        channel.postMessage("changed"); channel.close();
      }
    }
    return { data, error: null };
  } catch (error) {
    return { data: { user: null, session: null }, error: error as ApiError };
  }
}
export const auth = {
  getUser: async (): Promise<{ data: { user: AppUser | null }; error: unknown }> => Platform.OS === "web" ? webAuth("session") : supabase.auth.getUser(),
  signInWithPassword: (payload: Credentials) => Platform.OS === "web" ? webAuth("login", payload) : supabase.auth.signInWithPassword(payload),
  signUp: (payload: Credentials) => Platform.OS === "web" ? webAuth("signup", payload) : supabase.auth.signUp(payload),
  resend: (payload: { email: string; type: "signup"; options?: { captchaToken?: string } }) => Platform.OS === "web" ? webAuth("resend", payload) : supabase.auth.resend(payload),
  signOut: async (_options?: { scope: "local" }) => {
    if (Platform.OS !== "web") return supabase.auth.signOut(_options);
    const result = await webAuth("logout");
    if (result.error) throw new Error(result.error.message);
    return result;
  },
  onAuthStateChange: (listener: (event: string, session: { user: AppUser } | null) => void) => {
    if (Platform.OS !== "web") return supabase.auth.onAuthStateChange(listener);
    listeners.add(listener);
    const channel = typeof BroadcastChannel !== "undefined" ? new BroadcastChannel("auth-changed") : null;
    if (channel) channel.onmessage = () => window.location.reload();
    return { data: { subscription: { unsubscribe: () => { listeners.delete(listener); channel?.close(); } } } };
  },
};
