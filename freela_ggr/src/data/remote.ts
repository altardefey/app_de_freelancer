import { Platform } from "react-native";
import { webApi } from "../lib/webApi";
import { BUDGET_COLUMNS, JOB_COLUMNS, SERVICE_COLUMNS } from "../security/columns";
import { budgetInput, budgetStatus, quoteInput, rating as validRating, uuid } from "../security/validation";
import type { Budget, BudgetStatus, CompletedJob, Service } from "../types/app";
import { mutationError } from "../lib/requestErrors";
import { supabase } from "../lib/supabase";

type ServiceRow = {
  id: string | number;
  provider_id?: string | null;
  title?: string | null;
  category?: string | null;
  provider?: string | null;
  fixed_price_cents?: number | null;
  price_negotiable?: boolean;
  price?: string | number | null;
  rating?: string | number | null;
  description?: string | null;
  uf?: string | null;
  city?: string | null;
  neighborhood?: string | null;
  remote?: boolean;
  portfolio_path?: string | null;
  portfolio_paths?: string[];
  provider_premium?: boolean;
  unavailable?: boolean;
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
  details?: string | null;
  remote?: boolean;
  agreed_price_cents?: number | null;
  delivery?: string | null;
  quote_amount?: number | string | null;
  quote_message?: string | null;
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
function mapService(row: ServiceRow, mine = false): Service {
  return {
    id: String(row.id),
    providerId: row.provider_id ?? null,
    title: row.title || "Serviço",
    category: row.category || "Serviços",
    provider: row.provider || "Profissional",
    price: row.price_negotiable ? "A combinar" : row.fixed_price_cents == null && typeof row.price === "string" ? row.price : formatCurrency(row.price),
    fixedPriceCents: row.fixed_price_cents,
    priceNegotiable: row.price_negotiable,
    rating: formatRating(row.rating),
    description: row.description || "Profissional disponível para orçamento.",
    uf: row.uf || "",
    city: row.city || "",
    neighborhood: row.neighborhood || "",
    remote: Boolean(row.remote),
    portfolioPaths: (row.portfolio_paths?.length ? row.portfolio_paths : row.portfolio_path ? [row.portfolio_path] : []).slice(0, mine || row.provider_premium ? 10 : 3),
    providerPremium: row.provider_premium,
    unavailable: row.unavailable,
    trending: Boolean(row.trending),
    recent: Boolean(row.recent),
  };
}

function mapBudget(row: BudgetRow): Budget {
  const quoteAmount = row.quote_amount == null ? null : Number(row.quote_amount);
  return {
    id: String(row.id),
    client: row.client || "Cliente",
    service: row.service || "Serviço",
    value: formatCurrency(quoteAmount ?? row.value),
    date: row.date || formatDate(row.created_at),
    status: row.status || "solicitado",
    details: row.details ?? null,
    quoteAmount,
    agreedPriceCents: row.agreed_price_cents,
    delivery: row.delivery,
    createdAt: row.created_at ?? undefined,
    remote: Boolean(row.remote),
    quoteMessage: row.quote_message ?? null,
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

// pega o usuário logado para salvar registros com dono
async function currentUserId() {
  const { data } = await supabase.auth.getUser();
  return data.user?.id ?? null;
}

export async function listServices(mine = false): Promise<Service[]> {
  const items = new Map<string, Service>();
  for (let page = 0; ; page++) {
    let rows: ServiceRow[];
    if (Platform.OS === "web") rows = await webApi<ServiceRow[]>("services", { page, mine });
    else {
      const query = supabase.from("services")
        .select(SERVICE_COLUMNS)
        .order("created_at", { ascending: false }).order("id").range(page * 100, page * 100 + 99);
      if (mine) query.eq("provider_id", await currentUserId());
      const { data, error } = await query;
      if (error) throw new Error("Não foi possível carregar os serviços.");
      rows = data ?? [];
      const providerIds = rows.flatMap((row) => row.provider_id ? [row.provider_id] : []);
      const [premium, names, unavailable] = await Promise.all([
        supabase.rpc("catalog_premium_providers", { provider_ids: providerIds }),
        supabase.rpc("catalog_provider_names", { provider_ids: providerIds }),
        supabase.rpc("catalog_unavailable_providers", { provider_ids: providerIds }),
      ]);
      if (premium.error) throw premium.error;
      if (names.error && names.error.code !== "PGRST202") throw names.error;
      if (unavailable.error && unavailable.error.code !== "PGRST202") throw unavailable.error;
      const full = new Set<string>(unavailable.data ?? []);
      const active = new Set<string>(premium.data ?? []);
      rows = rows.map((row) => ({ ...row, provider: row.provider_id ? names.data?.[row.provider_id] ?? row.provider : row.provider, provider_premium: !!row.provider_id && active.has(row.provider_id), unavailable: !!row.provider_id && full.has(row.provider_id) }));
    }
    for (const row of rows) items.set(String(row.id), mapService(row, mine));
    if (rows.length < 100) return [...items.values()];
  }
}

export async function listBudgets(): Promise<Budget[]> {
  if (Platform.OS === "web") return (await webApi<BudgetRow[]>("budgets")).map(mapBudget);
  const { data, error } = await supabase
    .from("budgets")
    .select(BUDGET_COLUMNS)
    .order("created_at", { ascending: false }).limit(100);

  if (error) throw new Error("Não foi possível carregar os pedidos.");

  const items = (data ?? []).map((item) => mapBudget(item as BudgetRow));
  return items;
}

export async function listCompletedJobs(): Promise<CompletedJob[]> {
  if (Platform.OS === "web") return (await webApi<CompletedJobRow[]>("jobs")).map(mapCompletedJob);
  const { data, error } = await supabase
    .from("completed_jobs")
    .select(JOB_COLUMNS)
    .order("created_at", { ascending: false }).limit(100);

  if (error) throw new Error("Não foi possível carregar os serviços concluídos.");

  const items = (data ?? []).map((item) => mapCompletedJob(item as CompletedJobRow));
  return items;
}

export async function createBudget(
  payload: Omit<Budget, "id" | "date" | "status"> & {
    serviceId: string;
    professionalId?: string | null;
    whatsapp?: string;
    shareContact?: boolean;
    details?: string;
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

export async function submitBudgetQuote(id: string, quoteAmount: number, quoteMessage: string, delivery: string) {
  const quote = quoteInput({ id, quoteAmount, quoteMessage, delivery });
  if (Platform.OS === "web") {
    try { await webApi("budgetQuote", { id, quoteAmount, quoteMessage, delivery }); return; }
    catch (error) { throw mutationError(error as { message?: string }); }
  }
  const { error } = await supabase.from("budgets").update({
    status: "cotado",
    quote_amount: quote.quote_amount,
    quote_message: quote.quote_message,
    delivery: quote.delivery,
  }).eq("id", quote.id).select("id").single();
  if (error) throw mutationError(error);
}

export async function updateBudgetStatus(id: string, status: BudgetStatus) {
  uuid(id); budgetStatus(status);
  try {
    if (Platform.OS === "web") {
      await webApi("budgetStatus", { id, status });
    } else {
      const { error } = await supabase.from("budgets").update({ status }).eq("id", id).select("id").single();
      if (error) throw error;
    }
  } catch (failure) {
    const error = failure as { code?: string; message?: string };
    throw mutationError(error);
  }
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

export async function listProfessionalReviews(): Promise<CompletedJob[]> {
  if (Platform.OS === "web") return (await webApi<CompletedJobRow[]>("professionalReviews")).map(mapCompletedJob);
  const { data, error } = await supabase.rpc("professional_reviews");
  if (error) throw error;
  return (data ?? []).map(mapCompletedJob);
}

export async function getBudgetContact(id: string): Promise<string | null> {
  uuid(id);
  if (Platform.OS === "web") return webApi<string | null>("budgetContact", { id });
  const { data, error } = await supabase.rpc("budget_contact", { budget_id: id });
  if (error) throw error;
  return data;
}
