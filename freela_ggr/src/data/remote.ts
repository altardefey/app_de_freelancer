import { Platform } from "react-native";
import { webApi } from "../lib/webApi";
import { BUDGET_COLUMNS, JOB_COLUMNS, SERVICE_COLUMNS } from "../security/columns";
import { budgetInput, budgetStatus, rating as validRating, uuid } from "../security/validation";
import type { Budget, BudgetStatus, CompletedJob, Service } from "../types/app";
import { mutationError } from "../lib/requestErrors";
import { supabase } from "../lib/supabase";

type ServiceRow = {
  id: string | number;
  provider_id?: string | null;
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

// normaliza o que vem do supabase para o formato usado nas telas
function mapService(row: ServiceRow): Service {
  return {
    id: String(row.id),
    providerId: row.provider_id ?? null,
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

// evita quebrar a tela se a tabela ainda não existir no banco
function isMissingTable(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "PGRST205"
  );
}

// pega o usuário logado para salvar registros com dono
async function currentUserId() {
  const { data } = await supabase.auth.getUser();
  return data.user?.id ?? null;
}

export async function listServices(): Promise<Service[]> {
  if (Platform.OS === "web") return (await webApi<ServiceRow[]>("services")).map(mapService);
  const { data, error } = await supabase
    .from("services")
    .select(SERVICE_COLUMNS)
    .order("created_at", { ascending: false }).limit(100);

  if (error) {
    if (!isMissingTable(error)) console.warn("Erro ao listar serviços:");
    return [];
  }

  const items = (data ?? []).map((item) => mapService(item as ServiceRow));
  return items;
}

export async function listBudgets(): Promise<Budget[]> {
  if (Platform.OS === "web") return (await webApi<BudgetRow[]>("budgets")).map(mapBudget);
  const { data, error } = await supabase
    .from("budgets")
    .select(BUDGET_COLUMNS)
    .order("created_at", { ascending: false }).limit(100);

  if (error) {
    if (!isMissingTable(error)) console.warn("Erro ao listar orçamentos:");
    return [];
  }

  const items = (data ?? []).map((item) => mapBudget(item as BudgetRow));
  return items;
}

export async function listCompletedJobs(): Promise<CompletedJob[]> {
  if (Platform.OS === "web") return (await webApi<CompletedJobRow[]>("jobs")).map(mapCompletedJob);
  const { data, error } = await supabase
    .from("completed_jobs")
    .select(JOB_COLUMNS)
    .order("created_at", { ascending: false }).limit(100);

  if (error) {
    if (!isMissingTable(error)) console.warn("Erro ao listar serviços concluídos:");
    return [];
  }

  const items = (data ?? []).map((item) => mapCompletedJob(item as CompletedJobRow));
  return items;
}

export async function createBudget(
  payload: Omit<Budget, "id" | "date" | "status"> & {
    professionalId?: string | null;
    whatsapp?: string;
    status?: BudgetStatus;
  },
): Promise<Budget> {
  const input = budgetInput(payload);
  if (Platform.OS === "web") {
    try { return mapBudget(await webApi<BudgetRow>("createBudget", payload)); }
    catch (error) { throw mutationError(error as { message?: string }); }
  }
  const userId = await currentUserId();
  if (!userId) throw new Error("Entre na sua conta para enviar uma solicitação.");
  // liga o orçamento ao cliente e ao profissional, quando existir
  const { data, error } = await supabase
    .from("budgets")
    .insert({ ...input, user_id: userId })
    .select(BUDGET_COLUMNS)
    .single();

  if (error) throw mutationError(error);
  if (!data) throw new Error("Não foi possível confirmar o envio. Tente novamente.");
  return mapBudget(data as BudgetRow);
}

export async function updateBudgetStatus(id: string, status: BudgetStatus) {
  uuid(id); budgetStatus(status);
  if (Platform.OS === "web") {
    try { await webApi("budgetStatus", { id, status }); return; }
    catch (error) { throw mutationError(error as { message?: string }); }
  }
  const { error } = await supabase.from("budgets").update({ status }).eq("id", id).select("id").single();
  if (error) throw mutationError(error);
}

export async function updateJobRating(id: string, rating: number) {
  uuid(id); validRating(rating);
  if (Platform.OS === "web") {
    try { await webApi("rating", { id, rating }); return; }
    catch (error) { throw mutationError(error as { message?: string }); }
  }
  const { error } = await supabase.from("completed_jobs").update({ rating }).eq("id", id).select("id").single();
  if (error) throw mutationError(error);
}
