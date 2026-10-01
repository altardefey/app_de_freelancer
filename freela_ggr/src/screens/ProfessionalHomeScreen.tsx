import { useEffect, useState } from "react";
import { Alert, Pressable, ScrollView, Text, View } from "react-native";
import Feather from "@expo/vector-icons/Feather";

import { Logo } from "../components/Logo";
import { useSession } from "../context/SessionContext";
import { listBudgets, submitBudgetQuote, updateBudgetStatus } from "../data/remote";
import type { Budget, BudgetStatus } from "../types/app";
import { styles } from "./HomeScreen.styles";

function Pill({
  label,
  active,
  onPress,
}: {
  label: string;
  active?: boolean;
  onPress?: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={[styles.pill, active && styles.pillActive]}>
      <Text style={[styles.pillText, active && styles.pillTextActive]}>{label}</Text>
    </Pressable>
  );
}

export function ProfessionalHomeScreen() {
  const { logout } = useSession();
  const [budgetFilter, setBudgetFilter] = useState<"todos" | BudgetStatus>("todos");
  const [budgets, setBudgets] = useState<Budget[]>([]);

  useEffect(() => {
    let active = true;
    listBudgets().then((items) => {
      if (active) setBudgets(items);
    }).catch(() => {
      if (active) Alert.alert("Não foi possível carregar", "Tente entrar novamente em instantes.");
    });
    return () => {
      active = false;
    };
  }, []);

  const visibleBudgets = budgets.filter(
    (budget) => budgetFilter === "todos" || budget.status === budgetFilter,
  );
  const counts = {
    solicitado: budgets.filter((budget) => budget.status === "solicitado").length,
    cotado: budgets.filter((budget) => budget.status === "cotado").length,
    andamento: budgets.filter((budget) => budget.status === "em_andamento").length,
    realizado: budgets.filter((budget) => budget.status === "realizado").length,
  };

  async function updateBudget(id: string, status: BudgetStatus) {
    try {
      await updateBudgetStatus(id, status);
      setBudgets((current) =>
        current.map((budget) => (budget.id === id ? { ...budget, status } : budget)),
      );
    } catch (error) {
      Alert.alert("Orçamento não atualizado", error instanceof Error ? error.message : "Tente novamente em instantes.");
    }
  }

  async function quoteBudget(id: string, amount: number, message: string) {
    try {
      await submitBudgetQuote(id, amount, message);
      setBudgets((current) => current.map((budget) => budget.id === id ? {
        ...budget,
        status: "cotado",
        quoteAmount: amount,
        quoteMessage: message || null,
        value: amount.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }),
      } : budget));
    } catch (error) {
      Alert.alert("Proposta não enviada", error instanceof Error ? error.message : "Tente novamente em instantes.");
    }
  }

  return (
    <View style={styles.page}>
      <View style={styles.header}>
        <Logo />
        <View style={styles.headerActions}>
          <Text style={styles.headerRoleGreen}>PROFISSIONAL</Text>
          <Pressable style={styles.logoutButton} hitSlop={12} onPress={logout}>
            <Feather name="log-out" size={15} color="#71717A" />
            <Text style={styles.logout}>Sair</Text>
          </Pressable>
        </View>
      </View>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.overlineGreen}>PAINEL DO PROFISSIONAL</Text>
        <Text style={styles.pageTitle}>Olá, profissional.</Text>
        <Text style={styles.pageSubtitle}>
          Acompanhe seus pedidos e mantenha sua agenda em movimento.
        </Text>
        <View style={styles.metricGrid}>
          <Metric label="Solicitados" value={counts.solicitado} tone="blue" />
          <Metric label="Aguardando resposta" value={counts.cotado} tone="orange" />
          <Metric label="Em andamento" value={counts.andamento} tone="dark" />
          <Metric label="Concluídos" value={counts.realizado} tone="green" />
        </View>
        <Text style={styles.sectionTitle}>Seus orçamentos</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.categoryRow}
        >
          {(["todos", "solicitado", "cotado", "aceito", "em_andamento", "realizado", "recusado", "cancelado"] as const).map(
            (item) => (
              <Pill
                key={item}
                label={item === "todos" ? "Todos" : item[0].toUpperCase() + item.slice(1)}
                active={budgetFilter === item}
                onPress={() => setBudgetFilter(item)}
              />
            ),
          )}
        </ScrollView>
        {visibleBudgets.length ? (
          visibleBudgets.map((budget) => (
            <BudgetCard key={budget.id} budget={budget} onUpdate={updateBudget} onQuote={quoteBudget} />
          ))
        ) : (
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>Nenhum orçamento encontrado</Text>
            <Text style={styles.emptyText}>Os pedidos do banco aparecerão aqui.</Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

function Metric({
  label,
  value,
  tone,
  wide,
}: {
  label: string;
  value: string | number;
  tone: "blue" | "orange" | "green" | "dark";
  wide?: boolean;
}) {
  return (
    <View style={[styles.metric, styles[`metric${tone}`], wide && styles.metricWide]}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={styles.metricValue}>{value}</Text>
    </View>
  );
}

function BudgetCard({
  budget,
  onUpdate,
  onQuote,
}: {
  budget: Budget;
  onUpdate: (id: string, status: BudgetStatus) => void;
  onQuote: (id: string, amount: number, message: string) => void;
}) {
  const [quoteValue, setQuoteValue] = useState("");
  const [quoteMessage, setQuoteMessage] = useState("");
  const statusLabels: Record<BudgetStatus, string> = {
    solicitado: "Solicitado",
    cotado: "Proposta enviada",
    aceito: "Aceito",
    em_andamento: "Em andamento",
    realizado: "Realizado",
    recusado: "Recusado",
    cancelado: "Cancelado",
  };
  return (
    <View style={styles.budgetCard}>
      <View style={styles.cardTop}>
        <View>
          <Text style={styles.budgetClient}>{budget.client}</Text>
          <Text style={styles.budgetDate}>{budget.date}</Text>
        </View>
        <Text style={[styles.status, styles[`status${budget.status}`]]}>
          {statusLabels[budget.status]}
        </Text>
      </View>
      <Text style={styles.budgetService}>{budget.service}</Text>
      {budget.details ? <Text style={styles.budgetDate}>Detalhes: {budget.details}</Text> : null}
      <View style={styles.budgetBottom}>
        <Text style={styles.budgetValue}>{budget.value}</Text>
        {budget.status === "solicitado" ? (
          <View style={styles.quoteForm}>
            <TextInput
              value={quoteValue}
              onChangeText={setQuoteValue}
              keyboardType="decimal-pad"
              placeholder="Sua proposta (R$)"
              placeholderTextColor="#71717A"
              style={styles.input}
              accessibilityLabel="Valor da proposta em reais"
            />
            <TextInput
              value={quoteMessage}
              onChangeText={setQuoteMessage}
              placeholder="Mensagem (opcional)"
              placeholderTextColor="#71717A"
              style={styles.input}
              accessibilityLabel="Mensagem da proposta"
            />
            <View style={styles.actionRow}>
              <Pressable onPress={() => {
                const input = quoteValue.trim();
                const normalized = input.includes(",")
                  ? input.replace(/\./g, "").replace(",", ".")
                  : /^\d{1,3}(\.\d{3})+$/.test(input) ? input.replace(/\./g, "") : input;
                const amount = Number(normalized);
                if (!Number.isFinite(amount) || amount <= 0) {
                  Alert.alert("Valor inválido", "Informe um valor maior que zero.");
                  return;
                }
                onQuote(budget.id, amount, quoteMessage.trim());
              }}>
                <Text style={styles.actionText}>Enviar proposta</Text>
              </Pressable>
              <Pressable onPress={() => onUpdate(budget.id, "recusado")}>
                <Text style={styles.actionTextMuted}>Recusar</Text>
              </Pressable>
            </View>
          </View>
        ) : budget.status === "aceito" ? (
          <Pressable onPress={() => onUpdate(budget.id, "em_andamento")}>
            <Text style={styles.actionText}>Iniciar serviço</Text>
          </Pressable>
        ) : budget.status === "em_andamento" ? (
          <Pressable onPress={() => onUpdate(budget.id, "realizado")}>
            <Text style={styles.actionText}>Concluir</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}
