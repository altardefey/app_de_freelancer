import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Pressable, Share, Text, View } from "react-native";
import { router } from "expo-router";
import Feather from "@expo/vector-icons/Feather";
import { useSession } from "../context/SessionContext";
import { useSubscription } from "../context/SubscriptionContext";
import { listQuotes, type Quote } from "../data/quotes";
import { listBudgets, updateBudgetStatus } from "../data/remote";
import type { Budget, BudgetStatus } from "../types/app";
import { Button, Empty, Notice, Page } from "../ui/components";
import { colors, fonts, ui } from "../ui/design";
export const currency = (cents: number) =>
  (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
export function quoteText(quote: Quote) {
  return [
    "Orçamento · Freela",
    "Cliente: " + quote.client,
    "",
    quote.service,
    "",
    "Total: " + currency(quote.amount_cents),
    "Criado em " + new Date(quote.created_at).toLocaleDateString("pt-BR"),
  ].join("\n");
}
export function ProfessionalHomeScreen({
  quotesOnly = false,
}: {
  quotesOnly?: boolean;
}) {
  const { role } = useSession();
  const { usage, error: planError, refresh } = useSubscription();
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<"todos" | BudgetStatus>("todos");
  const [updating, setUpdating] = useState<string | null>(null);
  const lock = useRef(false);
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
    pendente: "Em análise",
    realizado: "Concluído",
    recusado: "Recusado",
  };
  return (
    <Page>
      <View style={ui.between}>
        <View style={{ gap: 8, maxWidth: "100%" }}>
          <Text style={ui.title}>
            {quotesOnly ? "Seus orçamentos" : "Seu trabalho, em dia."}
          </Text>
          <Text style={ui.body}>
            {quotesOnly
              ? "Do que você sabe fazer ao que vai fechar."
              : "Um lugar para organizar suas próximas oportunidades."}
          </Text>
        </View>
        <Button
          title="Novo orçamento"
          icon="plus"
          onPress={() => router.push("/novo-orcamento")}
        />
      </View>
      {!quotesOnly ? (
        <View style={[ui.hero, { backgroundColor: colors.green }]}>
          <Text style={ui.label}>Seu espaço para crescer</Text>
          <View style={ui.between}>
            <View style={{ flex: 1, minWidth: 120 }}>
              <Text
                style={[
                  ui.heroTitle,
                  { color: colors.ink, fontSize: 46, lineHeight: 52 },
                ]}
              >
                {usage?.premium
                  ? "Sem limites."
                  : usage
                    ? Math.max(0, usage.limit - usage.used) + " de 5"
                    : "Seu plano"}
              </Text>
              <Text style={[ui.body, { color: colors.ink }]}>
                {usage?.premium
                  ? "Orçamentos com seu Freela+."
                  : "orçamentos disponíveis neste mês"}
              </Text>
            </View>
            <Feather name="file-text" size={48} color={colors.ink} />
          </View>
          <View style={{ height: 1, backgroundColor: "rgba(31,22,51,.18)" }} />
          <View style={ui.between}>
            <Text style={[ui.small, { color: colors.ink }]}>
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
              <Text style={[ui.label, { textDecorationLine: "underline" }]}>
                {usage?.premium ? "Gerenciar Freela+" : "Conhecer o Freela+"}
              </Text>
            </Pressable>
          </View>
        </View>
      ) : null}
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
          <View style={{ gap: 16 }}>
            <View style={ui.between}>
              <Text style={ui.heading}>Orçamentos criados</Text>
              <Text style={ui.small}>
                {quotes.length}
                {quotes.length === 100 ? " mais recentes" : " no histórico"}
              </Text>
            </View>
            {!quotes.length ? (
              <Empty
                title="Seu primeiro orçamento começa aqui"
                text="Adicione o cliente, descreva o serviço e informe o valor. Depois, compartilhe como preferir."
                icon="file-text"
              />
            ) : (
              quotes.map((quote) => (
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
                  <Button
                    title="Compartilhar orçamento"
                    icon="share-2"
                    secondary
                    onPress={() => {
                      void Share.share({ message: quoteText(quote) }).catch(
                        () =>
                          setError(
                            "Não foi possível compartilhar neste dispositivo.",
                          ),
                      );
                    }}
                  />
                </View>
              ))
            )}
          </View>
          {!quotesOnly ? (
            <View style={{ gap: 16 }}>
              <Text style={ui.heading}>Pedidos recebidos</Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                {(
                  [
                    "todos",
                    "solicitado",
                    "pendente",
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
                      {b.status === "solicitado" ? (
                        <>
                          <Button
                            title="Analisar pedido"
                            busy={updating === b.id}
                            disabled={!!updating}
                            onPress={() => void update(b.id, "pendente")}
                          />
                          <Button
                            title="Recusar pedido"
                            secondary
                            disabled={!!updating}
                            onPress={() => void update(b.id, "recusado")}
                          />
                        </>
                      ) : b.status === "pendente" ? (
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
          ) : null}
        </>
      )}
    </Page>
  );
}
