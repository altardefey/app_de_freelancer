import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

import { emptyLocation, type LocationValue, type Role } from "../types/app";

type AuthScreen = "login" | "register";

type SessionContextValue = {
  role: Role | null;
  authScreen: AuthScreen;
  location: LocationValue;
  setLocation: (next: LocationValue) => void;
  login: (role: Role) => void;
  logout: () => void;
  openRegister: () => void;
  closeRegister: () => void;
  completeRegister: (payload: { role: Role; location: LocationValue }) => void;
};

const SessionContext = createContext<SessionContextValue | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [role, setRole] = useState<Role | null>(null);
  const [authScreen, setAuthScreen] = useState<AuthScreen>("login");
  const [location, setLocation] = useState<LocationValue>(emptyLocation);

  const value = useMemo<SessionContextValue>(
    () => ({
      role,
      authScreen,
      location,
      setLocation,
      login: (nextRole) => {
        setRole(nextRole);
        setAuthScreen("login");
      },
      logout: () => {
        setRole(null);
        setAuthScreen("login");
      },
      openRegister: () => setAuthScreen("register"),
      closeRegister: () => setAuthScreen("login"),
      completeRegister: (payload) => {
        setLocation(payload.location);
        setRole(payload.role);
        setAuthScreen("login");
      },
    }),
    [authScreen, location, role],
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
