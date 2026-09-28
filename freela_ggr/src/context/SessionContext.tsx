import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { Platform } from "react-native";
import { auth, type AppUser as User } from "../lib/auth";
import { webApi } from "../lib/webApi";
import { PROFILE_COLUMNS } from "../security/columns";

import { rateLimitMessage } from "../lib/requestErrors";
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
  captchaToken?: string;
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
  login: (payload: { role: Role; email: string; password: string; captchaToken?: string }) => Promise<LoginResult>;
  resendConfirmation: (email: string, captchaToken?: string) => Promise<LoginResult>;
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
  if (Platform.OS === "web") return webApi<ProfileRow | null>("profile");
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);
  try {
    const { data, error } = await supabase
      .from("profiles")
      .select(PROFILE_COLUMNS)
      .eq("id", userId)
      .abortSignal(controller.signal)
      .maybeSingle();

    if (error) throw error;
    return data as ProfileRow | null;
  } finally {
    clearTimeout(timeout);
  }
}

// traduz erros do supabase para mensagens mais úteis na tela
function authErrorMessage(error: { message: string; code?: string; status?: number }) {
  const limited = rateLimitMessage(error);
  if (limited) return limited;
  const normalized = error.message.toLowerCase();

  if (normalized.includes("invalid api key")) {
    return "O acesso está temporariamente indisponível por um problema de configuração do aplicativo. Entre em contato com o suporte.";
  }

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
    return "O cadastro está temporariamente indisponível. Tente novamente mais tarde.";
  }

  if (normalized.includes("password")) {
    return "A senha não foi aceita pelo Supabase. Tente uma senha mais forte.";
  }

  if (normalized.includes("email")) {
    return "Não foi possível usar esse e-mail. Confira os dados e tente novamente.";
  }

  return "Não foi possível concluir a operação. Tente novamente em instantes.";
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
          auth.getUser(),
          { data: { user: null }, error: null },
        );
        const currentUser = data.user ?? null;
        if (!mounted) return;
        setUser(currentUser);

        if (currentUser) {
          const profile = await loadProfile(currentUser.id);
          if (!mounted) return;
          setRole(profile?.role ?? null);
          setLocation(profileToLocation(profile));
        }
      } catch (error) {
        console.warn("Não foi possível carregar a sessão.");
      } finally {
        if (mounted) setLoading(false);
      }
    }

    hydrate();

    const { data: listener } = auth.onAuthStateChange((_event, session) => {
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
      resendConfirmation: async (email: string, captchaToken?: string) => {
        const { error } = await auth.resend({
          email: email.trim(),
          type: "signup",
          options: { captchaToken },
        });

        if (error) {
          return {
            success: false,
            message: authErrorMessage(error),
          };
        }
        return {
          success: true,
          message: "Um novo e-mail de confirmação foi enviado.",
        };
      },
      login: async ({ role: selectedRole, email, password, captchaToken }) => {
        // o auth valida a senha, depois a gente confere o perfil no banco
        const { data, error } = await auth.signInWithPassword({
          email: email.trim(),
          password,
          options: { captchaToken },
        });

        if (error) {
          if (error.code === "email_not_confirmed") {
            return {
              success: false,
              message: "Seu e-mail ainda não foi confirmado. Verifique sua caixa de entrada.",
            };
          }

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

        let profile: ProfileRow | null;
        try {
          profile = await loadProfile(data.user.id);
        } catch (error) {
          console.warn("Falha ao consultar o perfil.");
          await auth.signOut({ scope: "local" });
          setUser(null);
          setRole(null);
          setLocation(emptyLocation);
          return {
            success: false,
            message: "Sua conta foi autenticada, mas não foi possível carregar seu perfil. Tente novamente em instantes.",
          };
        }
        if (!profile) {
          await auth.signOut();
          setUser(null);
          setRole(null);
          setLocation(emptyLocation);
          return {
            success: false,
            message: "Sua conta foi autenticada, mas o perfil do aplicativo não foi encontrado ou não está acessível. Entre em contato com o suporte para regularizar o cadastro.",
          };
        }

        // impede entrar escolhendo o papel errado na tela inicial
        if (profile.role !== selectedRole) {
          await auth.signOut();
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
        await auth.signOut();
        setUser(null);
        setRole(null);
        setLocation(emptyLocation);
        setAuthScreen("login");
      },
      openRegister: () => setAuthScreen("register"),
      closeRegister: () => setAuthScreen("login"),
      completeRegister: async (payload) => {
        // manda os dados junto do cadastro para o trigger criar o perfil
        const { data, error } = await auth.signUp({
          email: payload.email.trim(),
          password: payload.password,
          options: {
            captchaToken: payload.captchaToken,
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

        if (!data.session) {
          return {
            success: true,
            pendingConfirmation: true,
            message:
              "Se o cadastro puder ser concluído, você receberá um e-mail de confirmação. Confira sua caixa de entrada.",
          };
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
