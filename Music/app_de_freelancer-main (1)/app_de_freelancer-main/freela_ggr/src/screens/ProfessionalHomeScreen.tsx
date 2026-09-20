import { useEffect, useState } from "react";
import { Alert, Pressable, ScrollView, Text, View } from "react-native";
import Feather from "@expo/vector-icons/Feather";

import { Logo } from "../components/Logo";
import { useSession } from "../context/SessionContext";
import { listBudgets, updateBudgetStatus } from "../data/remote";
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
    pendente: budgets.filter((budget) => budget.status === "pendente").length,
    realizado: budgets.filter((budget) => budget.status === "realizado").length,
  };

  async function updateBudget(id: string, status: BudgetStatus) {
    setBudgets((current) =>
      current.map((budget) => (budget.id === id ? { ...budget, status } : budget)),
    );
    await updateBudgetStatus(id, status);
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
          <Metric label="Pendentes" value={counts.pendente} tone="orange" />
          <Metric label="Realizados" value={counts.realizado} tone="green" />
          <Metric label="Este mês" value="R$ 0" tone="dark" wide />
        </View>
        <Pressable
          style={styles.greenButton}
          onPress={() =>
            Alert.alert("Em breve", "A criação de orçamentos será conectada ao backend depois.")
          }
        >
          <Text style={styles.greenButtonText}>+ Criar novo orçamento</Text>
        </Pressable>
        <Text style={styles.sectionTitle}>Seus orçamentos</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.categoryRow}
        >
          {(["todos", "solicitado", "pendente", "realizado", "recusado"] as const).map(
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
            <BudgetCard key={budget.id} budget={budget} onUpdate={updateBudget} />
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
}: {
  budget: Budget;
  onUpdate: (id: string, status: BudgetStatus) => void;
}) {
  const statusLabels: Record<BudgetStatus, string> = {
    solicitado: "Solicitado",
    pendente: "Pendente",
    realizado: "Realizado",
    recusado: "Recusado",
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
      <View style={styles.budgetBottom}>
        <Text style={styles.budgetValue}>{budget.value}</Text>
        {budget.status === "solicitado" ? (
          <View style={styles.actionRow}>
            <Pressable onPress={() => onUpdate(budget.id, "pendente")}>
              <Text style={styles.actionText}>Analisar</Text>
            </Pressable>
            <Pressable onPress={() => onUpdate(budget.id, "recusado")}>
              <Text style={styles.actionTextMuted}>Recusar</Text>
            </Pressable>
          </View>
        ) : budget.status === "pendente" ? (
          <Pressable onPress={() => onUpdate(budget.id, "realizado")}>
            <Text style={styles.actionText}>Concluir</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}
