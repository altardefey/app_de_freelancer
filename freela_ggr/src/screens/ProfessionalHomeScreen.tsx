import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { router } from "expo-router";
import Feather from "@expo/vector-icons/Feather";
import { useSession } from "../context/SessionContext";
import { useSubscription } from "../context/SubscriptionContext";
import { listQuotes, type Quote } from "../data/quotes";
import { listBudgets, submitBudgetQuote, updateBudgetStatus } from "../data/remote";
import type { Budget, BudgetStatus } from "../types/app";
import { Button, Empty, Field, Notice, Page } from "../ui/components";
import { fonts } from "../ui/design";
import { useAppearance } from "../ui/Appearance";
import { QuoteShare } from "../components/QuoteShare";
import { parseAmount } from "../security/quoteAmount";
export const currency = (cents: number) =>
  (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
export function ProfessionalHomeScreen({
  quotesOnly = false,
}: {
  quotesOnly?: boolean;
}) {
  const { colors, ui } = useAppearance();
  const { role } = useSession();
  const { usage, error: planError, refresh } = useSubscription();
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [proposalError, setProposalError] = useState<{ id: string; message: string }>();
  const [filter, setFilter] = useState<"todos" | BudgetStatus>("todos");
  const [updating, setUpdating] = useState<string | null>(null);
  const lock = useRef(false);
  const [drafts, setDrafts] = useState<Record<string, { value?: string; message?: string; delivery?: string }>>({});
  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [q, b] = await Promise.all([listQuotes(), listBudgets()]);
      setQuotes(q);
      setBudgets(b);
    } catch {
      setError("Não foi possível carregar seus orçamentos. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    if (role === "profissional") void load();
  }, [load, role]);
  async function update(id: string, status: BudgetStatus) {
    if (lock.current) return;
    lock.current = true;
    setUpdating(id);
    try {
      await updateBudgetStatus(id, status);
      setBudgets((old) => old.map((b) => (b.id === id ? { ...b, status } : b)));
    } catch {
      setError("Não foi possível atualizar o pedido. Tente novamente.");
    } finally {
      lock.current = false;
      setUpdating(null);
    }
  }
  async function sendProposal(budget: Budget) {
    const { id } = budget;
    if (lock.current) return;
    const draft = drafts[id];
    const cents = budget.agreedPriceCents ?? parseAmount(draft?.value ?? "");
    const delivery = draft?.delivery?.trim();
    if (!delivery) { setProposalError({ id, message: "Informe o prazo de entrega ou os dias disponíveis." }); return; }
    if (cents === null) { setProposalError({ id, message: "Informe um valor válido para a proposta." }); return; }
    lock.current = true;
    setUpdating(id);
    setProposalError(undefined);
    try {
      await submitBudgetQuote(id, cents / 100, draft?.message ?? "", delivery);
      setBudgets(old => old.map(b => b.id === id ? { ...b, status: "cotado", quoteAmount: cents / 100, quoteMessage: draft?.message, delivery, value: currency(cents) } : b));
      await refresh();
    } catch (failure) {
      setProposalError({ id, message: failure instanceof Error ? failure.message : "Não foi possível salvar a proposta. Seus dados foram mantidos." });
    } finally {
      lock.current = false;
      setUpdating(null);
    }
  }
  if (role !== "profissional")
    return (
      <Page>
        <Empty
          title="Área do profissional"
          text="Os orçamentos são criados por contas profissionais."
        />
      </Page>
    );
  const statuses = {
    solicitado: "Novo pedido",
    cotado: "Proposta enviada",
    aceito: "Aceito",
    em_andamento: "Em andamento",
    cancelado: "Cancelado",
    realizado: "Concluído",
    recusado: "Recusado",
  };
  return (
    <Page>
      <View style={ui.between}>
        <View style={{ gap: 8, maxWidth: "100%" }}>
          <Text style={ui.title}>
            {quotesOnly ? "Seus orçamentos" : "Painel profissional"}
          </Text>
        </View>

      </View>
      {!quotesOnly ? (
        <View style={[ui.hero, { backgroundColor: colors.green }]}>
          <Text style={[ui.label, { color: "#1F1633" }]}>Franquia de orçamentos</Text>
          <View style={ui.between}>
            <View style={{ flex: 1, minWidth: 120 }}>
              <Text
                style={[
                  ui.heroTitle,
                  { color: "#1F1633", fontSize: 46, lineHeight: 52 },
                ]}
              >
                {usage ? Math.max(0, usage.limit - usage.used) + " de " + usage.limit : "Seu plano"}
              </Text>
              <Text style={[ui.body, { color: "#1F1633" }]}>
                orçamentos disponíveis neste mês
              </Text>
            </View>
            <Feather name="file-text" size={48} color="#1F1633" />
          </View>
          <View style={{ height: 1, backgroundColor: "rgba(31,22,51,.18)" }} />
          <View style={ui.between}>
            <Text style={[ui.small, { color: "#1F1633" }]}>
              {usage
                ? "Franquia renova em " +
                  new Date(usage.resetsAt).toLocaleDateString("pt-BR", {
                    timeZone: "America/Sao_Paulo",
                  })
                : "Consulte sua franquia antes de criar."}
            </Text>
            <Pressable
              accessibilityRole="button"
              onPress={() => router.push("/freela-plus")}
              style={{ minHeight: 44, justifyContent: "center" }}
            >
              <Text style={[ui.label, { textDecorationLine: "underline", color: "#1F1633" }]}>
                {usage?.premium ? "Gerenciar Freela+" : "Conhecer o Freela+"}
              </Text>
            </Pressable>
          </View>
        </View>
      ) : null}
      {!quotesOnly && <Button title="Gerenciar meus anúncios" secondary onPress={() => router.push("/meus-anuncios")} />}
      {planError ? (
        <>
          <Notice>{planError}</Notice>
          <Button
            title="Consultar plano novamente"
            secondary
            onPress={() => void refresh()}
          />
        </>
      ) : null}
      {error ? (
        <>
          <Notice>{error}</Notice>
          <Button
            title="Tentar novamente"
            secondary
            onPress={() => void load()}
          />
        </>
      ) : null}
      {loading ? (
        <ActivityIndicator color={colors.purple} />
      ) : (
        <>
          {(
            <View style={{ gap: 16 }}>
              <Text style={ui.heading}>Pedidos recebidos</Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                {(
                  [
                    "todos",
                    "solicitado",
                    "cotado",
                    "aceito",
                    "em_andamento",
                    "cancelado",
                    "realizado",
                    "recusado",
                  ] as const
                ).map((item) => (
                  <Pressable
                    key={item}
                    accessibilityRole="button"
                    onPress={() => setFilter(item)}
                    style={[ui.chip, item === filter && ui.chipActive]}
                  >
                    <Text
                      style={[
                        ui.small,
                        {
                          fontFamily: fonts.medium,
                          color: item === filter ? colors.white : colors.ink,
                        },
                      ]}
                    >
                      {item === "todos" ? "Todos" : statuses[item]}
                    </Text>
                  </Pressable>
                ))}
              </View>
              {!budgets.filter((b) => filter === "todos" || b.status === filter)
                .length ? (
                <Empty
                  title="Nenhum pedido por aqui"
                  text="Quando um cliente solicitar seu serviço, você acompanha por aqui."
                />
              ) : (
                budgets
                  .filter((b) => filter === "todos" || b.status === filter)
                  .map((b) => (
                    <View key={b.id} style={ui.card}>
                      <View style={ui.between}>
                        <Text style={ui.heading}>{b.client}</Text>
                        <View style={ui.badge}>
                          <Text style={ui.small}>{statuses[b.status]}</Text>
                        </View>
                      </View>
                      <Text style={ui.body}>{b.service}</Text>
                      {b.details ? (
                        <Text style={ui.body}>{b.details}</Text>
                      ) : null}
                      <Text style={ui.heading}>{b.value}</Text>
                      {b.delivery && <Text style={ui.body}>Prazo ou disponibilidade: {b.delivery}</Text>}
                      {b.quoteMessage ? <Text style={ui.body}>{b.quoteMessage}</Text> : null}
                      {b.quoteAmount != null && b.createdAt && <QuoteShare budgetId={b.id} quote={{
                        client: b.client, service: b.service, amount_cents: Math.round(b.quoteAmount * 100),
                        created_at: b.createdAt, remote: b.remote, note: b.quoteMessage, delivery: b.delivery, details: b.details,
                      }} />}
                      {b.status === "solicitado" ? <>
                        {b.agreedPriceCents == null ?
                          <Field label="Valor da proposta (R$)" keyboardType="decimal-pad" value={drafts[b.id]?.value ?? ""} onChangeText={value => setDrafts(old => ({ ...old, [b.id]: { ...old[b.id], value } }))} /> :
                          <Text style={ui.label}>Preço fixo do anúncio: {currency(b.agreedPriceCents)}</Text>}
                        <Field label={b.remote ? "Prazo de entrega" : "Prazo ou dias disponíveis"} maxLength={200}
                          value={drafts[b.id]?.delivery ?? ""} onChangeText={delivery => setDrafts(old => ({ ...old, [b.id]: { ...old[b.id], delivery } }))} />
                        <Field label="Mensagem da proposta (opcional)" maxLength={600} value={drafts[b.id]?.message ?? ""} onChangeText={message => setDrafts(old => ({ ...old, [b.id]: { ...old[b.id], message } }))} />
                      </> : null}
                      {b.status === "solicitado" ? (
                        <>
                          {proposalError?.id === b.id && <Notice>{proposalError.message}</Notice>}
                          <Button
                            title="Salvar proposta"
                            busy={updating === b.id}
                            disabled={!!updating}
                            onPress={() => void sendProposal(b)}
                          />
                          <Button
                            title="Recusar pedido"
                            secondary
                            disabled={!!updating}
                            onPress={() => void update(b.id, "recusado")}
                          />
                        </>
                      ) : b.status === "aceito" ? (
                        <Button title="Iniciar serviço" busy={updating === b.id} disabled={!!updating} onPress={() => void update(b.id, "em_andamento")} />
                      ) : b.status === "em_andamento" ? (
                        <Button
                          title="Marcar como concluído"
                          busy={updating === b.id}
                          disabled={!!updating}
                          onPress={() => void update(b.id, "realizado")}
                        />
                      ) : null}
                    </View>
                  ))
              )}
            </View>
          )}
          {!!quotes.length && (
          <View style={{ gap: 16 }}>
            <View style={ui.between}>
              <Text style={ui.heading}>Orçamentos anteriores</Text>
              <Text style={ui.small}>
                {quotes.length}
                {quotes.length === 100 ? " mais recentes" : " no histórico"}
              </Text>
            </View>
            {              quotes.map((quote) => (
                <View key={quote.id} style={ui.card}>
                  <View style={ui.between}>
                    <View style={{ flex: 1 }}>
                      <Text style={ui.heading}>{quote.client}</Text>
                      <Text style={ui.small}>
                        {new Date(quote.created_at).toLocaleDateString("pt-BR")}
                      </Text>
                    </View>
                    <Text style={[ui.heading, { color: colors.success }]}>
                      {currency(quote.amount_cents)}
                    </Text>
                  </View>
                  <Text style={ui.body}>{quote.service}</Text>
                  <QuoteShare quote={quote} />
                </View>
              ))}
          </View>
          )}
        </>
      )}
    </Page>
  );
}
