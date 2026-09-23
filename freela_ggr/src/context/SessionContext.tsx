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

type LoginResult = {
  success: boolean;
  message?: string;
};

type RegisterResult = {
  success: boolean;
  message?: string;
  pendingConfirmation?: boolean;
};

type SessionContextValue = {
  role: Role | null;
  authScreen: AuthScreen;
  location: LocationValue;
  user: User | null;
  loading: boolean;
  setLocation: (next: LocationValue) => void;
  login: (payload: { role: Role; email: string; password: string }) => Promise<LoginResult>;
  logout: () => Promise<void>;
  openRegister: () => void;
  closeRegister: () => void;
  completeRegister: (payload: RegisterPayload) => Promise<RegisterResult>;
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

// evita deixar a tela presa se o supabase demorar demais
function withTimeout<T>(promise: Promise<T>, fallback: T, timeoutMs = 5000) {
  return Promise.race([
    promise,
    new Promise<T>((resolve) => {
      setTimeout(() => resolve(fallback), timeoutMs);
    }),
  ]);
}

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

// busca o perfil que completa os dados do usuário autenticado
async function loadProfile(userId: string) {
  const { data, error } = await withTimeout(
    Promise.resolve(supabase.from("profiles").select("*").eq("id", userId).maybeSingle()),
    {
      data: null,
      error: null,
      count: null,
      status: 408,
      statusText: "Timeout",
      success: true,
    },
  );

  if (error) return null;
  return data as ProfileRow | null;
}

// traduz erros do supabase para mensagens mais úteis na tela
function authErrorMessage(error: { message: string; code?: string; status?: number }) {
  const normalized = error.message.toLowerCase();

  if (
    error.code === "invalid_credentials" ||
    normalized.includes("invalid login credentials")
  ) {
    return "E-mail ou senha inválidos. Confira seus dados e tente novamente.";
  }

  if (normalized.includes("already") || normalized.includes("registered")) {
    return "Esse e-mail já está cadastrado. Tente entrar pelo login.";
  }

  if (
    normalized.includes("signup") ||
    normalized.includes("sign up") ||
    normalized.includes("disabled") ||
    normalized.includes("not allowed")
  ) {
    return "O cadastro por e-mail parece estar desativado no Supabase. Vá em Authentication > Providers > Email e ative o provedor de e-mail e o cadastro de novos usuários.";
  }

  if (normalized.includes("rate limit")) {
    return "O Supabase atingiu o limite temporário de envio de e-mails deste projeto. Para testar agora, desative a confirmação por e-mail em Authentication > Providers > Email ou aguarde o limite liberar.";
  }

  if (normalized.includes("password")) {
    return "A senha não foi aceita pelo Supabase. Tente uma senha mais forte.";
  }

  if (normalized.includes("email")) {
    return `O Supabase recusou este e-mail: ${error.message}`;
  }

  return `Operação não concluída: ${error.message}`;
}

// salva os dados do onboarding na tabela de perfis
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

  return { success: !error, message: error?.message };
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
      try {
        const { data } = await withTimeout(
          supabase.auth.getSession(),
          { data: { session: null }, error: null },
        );
        const currentUser = data.session?.user ?? null;
        if (!mounted) return;
        setUser(currentUser);

        if (currentUser) {
          const profile = await loadProfile(currentUser.id);
          if (!mounted) return;
          setRole(profile?.role ?? null);
          setLocation(profileToLocation(profile));
        }
      } catch (error) {
        console.warn("Não foi possível carregar a sessão:", error);
      } finally {
        if (mounted) setLoading(false);
      }
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
        // o auth valida a senha, depois a gente confere o perfil no banco
        const { data, error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });

        if (error) {
          return {
            success: false,
            message: authErrorMessage(error),
          };
        }

        if (!data.user) {
          return {
            success: false,
            message: "Não foi possível identificar a conta. Tente novamente.",
          };
        }

        const profile = await loadProfile(data.user.id);
        if (!profile) {
          await supabase.auth.signOut();
          setUser(null);
          setRole(null);
          setLocation(emptyLocation);
          return {
            success: false,
            message: "Sua conta não possui um perfil cadastrado. Acesso negado.",
          };
        }

        // impede entrar escolhendo o papel errado na tela inicial
        if (profile.role !== selectedRole) {
          await supabase.auth.signOut();
          setUser(null);
          setRole(null);
          setLocation(emptyLocation);
          return {
            success: false,
            message: "Este cadastro não pertence ao perfil selecionado.",
          };
        }

        setUser(data.user);
        setRole(profile.role);
        setLocation(profileToLocation(profile));
        setAuthScreen("login");

        return { success: true };
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
        // manda os dados junto do cadastro para o trigger criar o perfil
        const { data, error } = await supabase.auth.signUp({
          email: payload.email.trim(),
          password: payload.password,
          options: {
            data: {
              role: payload.role,
              cep: payload.location.cep,
              street: payload.location.street,
              neighborhood: payload.location.neighborhood,
              uf: payload.location.uf,
              state_name: payload.location.stateName,
              city: payload.location.city,
              whatsapp: payload.whatsapp.replace(/\D/g, ""),
              services: payload.services,
            },
          },
        });

        if (error) {
          return { success: false, message: authErrorMessage(error) };
        }

        const signedUser = data.user;

        if (signedUser?.identities?.length === 0) {
          return {
            success: false,
            message: "Esse e-mail já está cadastrado. Tente entrar pelo login.",
          };
        }

        if (signedUser && !data.session) {
          return {
            success: true,
            pendingConfirmation: true,
            message:
              "Cadastro criado. Agora confirme o e-mail pelo link que o Supabase enviou e depois entre pelo login.",
          };
        }

        if (signedUser) {
          const profile = await saveProfile(signedUser.id, payload);
          if (!profile.success) {
            return {
              success: false,
              message:
                "A conta foi criada, mas o perfil não foi salvo. Confirme o e-mail e tente entrar pelo login.",
            };
          }
        }

        setUser(signedUser);
        setLocation(payload.location);
        setRole(payload.role);
        setAuthScreen("login");

        return { success: true };
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
