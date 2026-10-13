import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { AppState } from "react-native";
import { useSession } from "./SessionContext";
import { getUsage, syncSubscription, type Usage } from "../data/quotes";
import { billing, billingAvailable } from "../lib/billing";
type Value = {
  usage: Usage | null;
  loading: boolean;
  error: string;
  refresh: () => Promise<void>;
  sync: () => Promise<void>;
};
const Context = createContext<Value | null>(null);
export function SubscriptionProvider({ children }: { children: ReactNode }) {
  const { user, role } = useSession();
  const [usage, setUsage] = useState<Usage | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const identity = useRef(user?.id);
  identity.current = user?.id;
  const refresh = useCallback(async () => {
    const id = user?.id;
    if (!id || role !== "profissional") return;
    setLoading(true);
    try {
      const next = await getUsage();
      if (identity.current === id) {
        setUsage(next);
        setError("");
      }
    } catch {
      if (identity.current === id) {
        setUsage(null);
        setError("Não foi possível consultar seu plano. Tente novamente.");
      }
    } finally {
      if (identity.current === id) setLoading(false);
    }
  }, [user?.id, role]);
  const sync = useCallback(async () => {
    await syncSubscription();
    await refresh();
  }, [refresh]);
  useEffect(() => {
    setUsage(null);
    setError("");
    void refresh();
    if (user && role === "profissional" && billingAvailable) {
      void billing(user.id).catch(() => {
        if (identity.current === user.id)
          setError(
            "Não foi possível conectar à loja. Tente novamente na página Freela+.",
          );
      });
    }
    const listener = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        void refresh();
        if (user && role === "profissional" && billingAvailable)
          void sync().catch(() => {});
      }
    });
    return () => listener.remove();
  }, [refresh, sync, user?.id, role]);
  return (
    <Context.Provider value={{ usage, loading, error, refresh, sync }}>
      {children}
    </Context.Provider>
  );
}
export function useSubscription() {
  const value = useContext(Context);
  if (!value) throw new Error("SubscriptionProvider is required");
  return value;
}
