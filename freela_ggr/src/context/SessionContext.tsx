import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { User } from "@supabase/supabase-js";

import { supabase } from "../lib/supabase";
import { emptyLocation, type LocationValue, type Role } from "../types/app";

type AuthScreen = "login" | "register";

type RegisterPayload = {
  role: Role;
  location: LocationValue;
  email: string;
  password: string;
  whatsapp: string;
  services: string[];
};

type SessionContextValue = {
  role: Role | null;
  authScreen: AuthScreen;
  location: LocationValue;
  user: User | null;
  loading: boolean;
  setLocation: (next: LocationValue) => void;
  login: (payload: { role: Role; email: string; password: string }) => Promise<boolean>;
  logout: () => Promise<void>;
  openRegister: () => void;
  closeRegister: () => void;
  completeRegister: (payload: RegisterPayload) => Promise<boolean>;
};

type ProfileRow = {
  role?: Role | null;
  cep?: string | null;
  street?: string | null;
  neighborhood?: string | null;
  uf?: string | null;
  state_name?: string | null;
  city?: string | null;
};

const SessionContext = createContext<SessionContextValue | null>(null);

function profileToLocation(profile: ProfileRow | null): LocationValue {
  if (!profile) return emptyLocation;
  return {
    cep: profile.cep ?? "",
    street: profile.street ?? "",
    neighborhood: profile.neighborhood ?? "",
    uf: profile.uf ?? "",
    stateName: profile.state_name ?? "",
    city: profile.city ?? "",
  };
}

async function loadProfile(userId: string) {
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .maybeSingle();

  if (error) return null;
  return data as ProfileRow | null;
}

async function saveProfile(userId: string, payload: RegisterPayload) {
  const { error } = await supabase.from("profiles").upsert({
    id: userId,
    role: payload.role,
    cep: payload.location.cep,
    street: payload.location.street,
    neighborhood: payload.location.neighborhood,
    uf: payload.location.uf,
    state_name: payload.location.stateName,
    city: payload.location.city,
    whatsapp: payload.whatsapp.replace(/\D/g, ""),
    services: payload.services,
  });

  return !error;
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const [role, setRole] = useState<Role | null>(null);
  const [authScreen, setAuthScreen] = useState<AuthScreen>("login");
  const [location, setLocation] = useState<LocationValue>(emptyLocation);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function hydrate() {
      const { data } = await supabase.auth.getSession();
      const currentUser = data.session?.user ?? null;
      if (!mounted) return;
      setUser(currentUser);

      if (currentUser) {
        const profile = await loadProfile(currentUser.id);
        if (!mounted) return;
        setRole(profile?.role ?? null);
        setLocation(profileToLocation(profile));
      }

      setLoading(false);
    }

    hydrate();

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (!session?.user) {
        setRole(null);
        setLocation(emptyLocation);
      }
    });

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  const value = useMemo<SessionContextValue>(
    () => ({
      role,
      authScreen,
      location,
      user,
      loading,
      setLocation,
      login: async ({ role: selectedRole, email, password }) => {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });

        if (error) return false;

        setUser(data.user);
        setRole(selectedRole);
        setAuthScreen("login");

        if (data.user) {
          const profile = await loadProfile(data.user.id);
          if (profile?.role) setRole(profile.role);
          if (profile) setLocation(profileToLocation(profile));
        }

        return true;
      },
      logout: async () => {
        await supabase.auth.signOut();
        setUser(null);
        setRole(null);
        setLocation(emptyLocation);
        setAuthScreen("login");
      },
      openRegister: () => setAuthScreen("register"),
      closeRegister: () => setAuthScreen("login"),
      completeRegister: async (payload) => {
        const { data, error } = await supabase.auth.signUp({
          email: payload.email.trim(),
          password: payload.password,
        });

        if (error) return false;

        const signedUser = data.user;
        setUser(signedUser);
        setLocation(payload.location);
        setRole(payload.role);
        setAuthScreen("login");

        if (signedUser) {
          await saveProfile(signedUser.id, payload);
        }

        return true;
      },
    }),
    [authScreen, loading, location, role, user],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const context = useContext(SessionContext);
  if (!context) {
    throw new Error("useSession precisa estar dentro de SessionProvider");
  }
  return context;
}
