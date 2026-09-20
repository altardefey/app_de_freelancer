import { fallbackBudgets, fallbackCompletedJobs, fallbackServices } from "./localFallback";
import type { Budget, BudgetStatus, CompletedJob, Service } from "../types/app";
import { supabase } from "../lib/supabase";

type ServiceRow = {
  id: string | number;
  title?: string | null;
  category?: string | null;
  provider?: string | null;
  price?: string | number | null;
  rating?: string | number | null;
  description?: string | null;
  uf?: string | null;
  city?: string | null;
  neighborhood?: string | null;
  trending?: boolean | null;
  recent?: boolean | null;
};

type BudgetRow = {
  id: string | number;
  client?: string | null;
  service?: string | null;
  value?: string | number | null;
  date?: string | null;
  status?: BudgetStatus | null;
  created_at?: string | null;
};

type CompletedJobRow = {
  id: string | number;
  title?: string | null;
  provider?: string | null;
  date?: string | null;
  rating?: number | null;
  created_at?: string | null;
};

function formatCurrency(value: string | number | null | undefined) {
  if (typeof value === "number") {
    return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  }
  return value?.toString() || "R$ 0,00";
}

function formatRating(value: string | number | null | undefined) {
  if (typeof value === "number") return value.toFixed(1).replace(".", ",");
  return value?.toString() || "4,8";
}

function formatDate(value: string | null | undefined) {
  if (!value) return "Hoje";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
}

function mapService(row: ServiceRow): Service {
  return {
    id: String(row.id),
    title: row.title || "Serviço",
    category: row.category || "Serviços",
    provider: row.provider || "Profissional",
    price: formatCurrency(row.price),
    rating: formatRating(row.rating),
    description: row.description || "Profissional disponível para orçamento.",
    uf: row.uf || "",
    city: row.city || "",
    neighborhood: row.neighborhood || "",
    trending: Boolean(row.trending),
    recent: Boolean(row.recent),
  };
}

function mapBudget(row: BudgetRow): Budget {
  return {
    id: String(row.id),
    client: row.client || "Cliente",
    service: row.service || "Serviço",
    value: formatCurrency(row.value),
    date: row.date || formatDate(row.created_at),
    status: row.status || "solicitado",
  };
}

function mapCompletedJob(row: CompletedJobRow): CompletedJob {
  return {
    id: String(row.id),
    title: row.title || "Serviço concluído",
    provider: row.provider || "Profissional",
    date: row.date || `Finalizado em ${formatDate(row.created_at)}`,
    rating: row.rating ?? null,
  };
}

function isMissingTable(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "PGRST205"
  );
}

async function currentUserId() {
  const { data } = await supabase.auth.getUser();
  return data.user?.id ?? null;
}

export async function listServices(): Promise<Service[]> {
  const { data, error } = await supabase
    .from("services")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    if (!isMissingTable(error)) console.warn("Erro ao listar serviços:", error.message);
    return fallbackServices;
  }

  const items = (data ?? []).map((item) => mapService(item as ServiceRow));
  return items.length ? items : fallbackServices;
}

export async function listBudgets(): Promise<Budget[]> {
  const { data, error } = await supabase
    .from("budgets")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    if (!isMissingTable(error)) console.warn("Erro ao listar orçamentos:", error.message);
    return fallbackBudgets;
  }

  const items = (data ?? []).map((item) => mapBudget(item as BudgetRow));
  return items.length ? items : fallbackBudgets;
}

export async function listCompletedJobs(): Promise<CompletedJob[]> {
  const { data, error } = await supabase
    .from("completed_jobs")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    if (!isMissingTable(error)) console.warn("Erro ao listar serviços concluídos:", error.message);
    return fallbackCompletedJobs;
  }

  const items = (data ?? []).map((item) => mapCompletedJob(item as CompletedJobRow));
  return items.length ? items : fallbackCompletedJobs;
}

export async function createBudget(
  payload: Omit<Budget, "id" | "date" | "status"> & {
    whatsapp?: string;
    status?: BudgetStatus;
  },
): Promise<Budget> {
  const optimistic: Budget = {
    id: `local-${Date.now()}`,
    client: payload.client,
    service: payload.service,
    value: payload.value,
    date: "Hoje",
    status: payload.status ?? "solicitado",
  };

  const userId = await currentUserId();
  const { data, error } = await supabase
    .from("budgets")
    .insert({
      user_id: userId,
      client: optimistic.client,
      service: optimistic.service,
      value: optimistic.value,
      status: optimistic.status,
      whatsapp: payload.whatsapp ?? null,
    })
    .select("*")
    .single();

  if (error) {
    if (!isMissingTable(error)) console.warn("Erro ao criar orçamento:", error.message);
    return optimistic;
  }

  return data ? mapBudget(data as BudgetRow) : optimistic;
}

export async function updateBudgetStatus(id: string, status: BudgetStatus) {
  if (id.startsWith("local-")) return;
  const { error } = await supabase.from("budgets").update({ status }).eq("id", id);
  if (error && !isMissingTable(error)) {
    console.warn("Erro ao atualizar orçamento:", error.message);
  }
}

export async function updateJobRating(id: string, rating: number) {
  if (id.startsWith("local-")) return;
  const { error } = await supabase.from("completed_jobs").update({ rating }).eq("id", id);
  if (error && !isMissingTable(error)) {
    console.warn("Erro ao avaliar serviço:", error.message);
  }
}
