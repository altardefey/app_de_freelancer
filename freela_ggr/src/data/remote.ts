import type { Budget, CompletedJob, Service } from "../types/app";
import { supabase } from "../utils/supabase";

async function readTable<T>(table: string): Promise<T[]> {
  try {
    const { data, error } = await supabase.from(table).select("*");
    if (error || !data) return [];
    return data as T[];
  } catch {
    return [];
  }
}

export function listServices() {
  return readTable<Service>("services");
}

export function listBudgets() {
  return readTable<Budget>("budgets");
}

export function listCompletedJobs() {
  return readTable<CompletedJob>("completed_jobs");
}

export async function createBudget(
  payload: Omit<Budget, "id" | "date" | "status"> & {
    whatsapp?: string;
  },
): Promise<Budget> {
  const budget: Budget = {
    id: `local-${Date.now()}`,
    client: payload.client,
    service: payload.service,
    value: payload.value,
    date: "Hoje",
    status: "pendente",
  };

  try {
    const { data, error } = await supabase
      .from("budgets")
      .insert({
        client: budget.client,
        service: budget.service,
        value: budget.value,
        status: budget.status,
        whatsapp: payload.whatsapp ?? null,
      })
      .select("*")
      .single();
    if (!error && data) return data as Budget;
  } catch {
    // Tabelas ainda em construção: o orçamento fica só na sessão.
  }

  return budget;
}

export async function updateBudgetStatus(id: string, status: Budget["status"]) {
  try {
    await supabase.from("budgets").update({ status }).eq("id", id);
  } catch {
    // Sem tabela ainda: a tela já atualiza o estado local.
  }
}

export async function updateJobRating(id: string, rating: number) {
  try {
    await supabase.from("completed_jobs").update({ rating }).eq("id", id);
  } catch {
    // Sem tabela ainda: a tela já atualiza o estado local.
  }
}
