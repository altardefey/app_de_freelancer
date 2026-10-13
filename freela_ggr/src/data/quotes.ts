import { Platform } from "react-native";
import { supabase } from "../lib/supabase";
import { webApi } from "../lib/webApi";
export type Quote = {
  id: string;
  user_id: string;
  request_id: string;
  client: string;
  service: string;
  amount_cents: number;
  whatsapp: string | null;
  created_at: string;
};
export type QuoteInput = Pick<
  Quote,
  "request_id" | "client" | "service" | "amount_cents" | "whatsapp"
>;
export type Usage = {
  used: number;
  limit: number;
  premium: boolean;
  resetsAt: string;
};
export async function getUsage(): Promise<Usage> {
  if (Platform.OS === "web") return webApi<Usage>("freelaUsage");
  const { data, error } = await supabase.rpc("freela_usage");
  if (error)
    throw new Error("Não foi possível consultar seu plano. Tente novamente.");
  return data;
}
export async function listQuotes(): Promise<Quote[]> {
  if (Platform.OS === "web") return webApi<Quote[]>("quotes");
  const { data, error } = await supabase
    .from("professional_quotes")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw new Error("Não foi possível carregar os orçamentos.");
  return data ?? [];
}
export async function saveQuote(input: QuoteInput): Promise<Quote> {
  if (Platform.OS === "web") return webApi<Quote>("createQuote", input);
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Entre novamente na sua conta.");
  const { data, error } = await supabase
    .from("professional_quotes")
    .insert({ ...input, user_id: user.id })
    .select()
    .single();
  if (error?.code === "23505") {
    const existing = await supabase
      .from("professional_quotes")
      .select("*")
      .eq("request_id", input.request_id)
      .single();
    if (existing.data) return existing.data;
  }
  if (error)
    throw Object.assign(
      new Error(
        error.code === "PT402"
          ? "Você usou os 5 orçamentos deste mês. Conheça o Freela+ ou aguarde a renovação da franquia."
          : "Não foi possível salvar. Seu rascunho foi mantido.",
      ),
      { code: error.code },
    );
  return data;
}
export async function syncSubscription() {
  if (Platform.OS === "web") return webApi("syncSubscription");
  const { error } = await supabase.functions.invoke("revenuecat-sync", {
    body: {},
  });
  if (error)
    throw new Error(
      "Não foi possível atualizar a assinatura. Tente restaurar a compra em instantes.",
    );
}
