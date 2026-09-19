import Feather from "@expo/vector-icons/Feather";
import * as ImagePicker from "expo-image-picker";
import { useMemo, useRef, useState, type ReactNode } from "react";
import {
  Alert,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";

import Animated, {
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { styles } from "./HomeScreen.styles";

type Role = "cliente" | "profissional";
type BudgetStatus = "solicitado" | "pendente" | "realizado" | "recusado";
type Service = {
  id: string;
  title: string;
  category: string;
  provider: string;
  price: string;
  rating: string;
  description: string;
  trending?: boolean;
  recent?: boolean;
};
type Budget = {
  id: string;
  client: string;
  service: string;
  value: string;
  date: string;
  status: BudgetStatus;
};

const services: Service[] = [
  {
    id: "1",
    title: "Pintura residencial",
    category: "Pintura",
    provider: "Casa Nova Serviços",
    price: "R$ 180",
    rating: "4,9",
    description: "Paredes, tetos e acabamento para ambientes residenciais.",
    trending: true,
    recent: true,
  },
  {
    id: "2",
    title: "Instalação elétrica",
    category: "Elétrica",
    provider: "Voltagem Pro",
    price: "R$ 120",
    rating: "4,8",
    description: "Instalações, reparos e revisão elétrica com segurança.",
    trending: true,
  },
  {
    id: "3",
    title: "Limpeza pós-obra",
    category: "Limpeza",
    provider: "Brilho Total",
    price: "R$ 220",
    rating: "4,7",
    description: "Limpeza detalhada para entregar seu espaço pronto.",
    recent: true,
  },
  {
    id: "4",
    title: "Reparo hidráulico",
    category: "Hidráulica",
    provider: "Fluxo Assistência",
    price: "R$ 95",
    rating: "4,9",
    description: "Vazamentos, torneiras, registros e tubulações.",
    trending: true,
    recent: true,
  },
  {
    id: "5",
    title: "Móveis planejados",
    category: "Marcenaria",
    provider: "Oficina Linha",
    price: "R$ 650",
    rating: "4,8",
    description: "Projeto e montagem de móveis sob medida.",
    recent: true,
  },
  {
    id: "6",
    title: "Manutenção de ar-condicionado",
    category: "Refrigeração",
    provider: "Clima Certo",
    price: "R$ 150",
    rating: "4,6",
    description: "Higienização e manutenção preventiva.",
    trending: true,
  },
];
const initialBudgets: Budget[] = [
  {
    id: "1",
    client: "Marina Alves",
    service: "Pintura residencial",
    value: "R$ 980",
    date: "Hoje",
    status: "solicitado",
  },
  {
    id: "2",
    client: "Rafael Costa",
    service: "Instalação elétrica",
    value: "R$ 320",
    date: "Ontem",
    status: "pendente",
  },
  {
    id: "3",
    client: "Bianca Souza",
    service: "Limpeza pós-obra",
    value: "R$ 540",
    date: "12 jun",
    status: "realizado",
  },
  {
    id: "4",
    client: "Eduardo Lima",
    service: "Reparo hidráulico",
    value: "R$ 210",
    date: "10 jun",
    status: "recusado",
  },
];
const categories = [
  "Todos",
  "Pintura",
  "Elétrica",
  "Hidráulica",
  "Limpeza",
  "Marcenaria",
  "Refrigeração",
];
const dictionary = services.flatMap((service) => [
  service.title.toLowerCase(),
  service.category.toLowerCase(),
]);

function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}
function distance(first: string, second: string) {
  const matrix = Array.from({ length: second.length + 1 }, (_, row) =>
    Array.from({ length: first.length + 1 }, (_, column) =>
      row === 0 ? column : column === 0 ? row : 0,
    ),
  );
  for (let row = 1; row <= second.length; row += 1)
    for (let column = 1; column <= first.length; column += 1)
      matrix[row][column] = Math.min(
        matrix[row - 1][column] + 1,
        matrix[row][column - 1] + 1,
        matrix[row - 1][column - 1] +
          (second[row - 1] === first[column - 1] ? 0 : 1),
      );
  return matrix[second.length][first.length];
}
function findSuggestion(query: string) {
  const term = normalize(query);
  if (
    term.length < 3 ||
    dictionary.some((word) => word === term || word.includes(term))
  )
    return null;
  const suggestion = dictionary.reduce<{ word: string; score: number } | null>(
    (best, word) => {
      const score = distance(term, word);
      return score <= Math.max(2, Math.floor(term.length / 3)) &&
        (!best || score < best.score)
        ? { word, score }
        : best;
    },
    null,
  );
  return suggestion?.word ?? null;
}
function Logo() {
  return (
    <View style={styles.logo}>
      <View style={styles.logoMark}>
        <Text style={styles.logoGlyph}>ƒ</Text>
      </View>
      <Text style={styles.logoText}>freela</Text>
    </View>
  );
}

function LoginActionButton({
  children,
  variant,
  icon,
  onPress,
  actionDelay = 0,
}: {
  children: ReactNode;
  variant: "lime" | "dark";
  icon?: "user" | "briefcase";
  onPress: () => void;
  actionDelay?: number;
}) {
  const pulse = useSharedValue(0);
  const handlePress = () => {
    pulse.value = 0;
    pulse.value = withSequence(
      withTiming(0.15, { duration: 0 }),
      withTiming(1, { duration: 650 }, () => {
      pulse.value = 0;
      }),
    );
    if (actionDelay > 0) {
      setTimeout(onPress, actionDelay);
    } else {
      onPress();
    }
  };

  const ringStyle = useAnimatedStyle(() => ({
    opacity: interpolate(pulse.value, [0, 0.15, 1], [0, 1, 0]),
    transform: [{ scale: interpolate(pulse.value, [0, 0.15, 1], [0.95, 1, 1.45]) }],
  }));

  return (
    <View style={styles.loginButtonWrap}>
      <Animated.View
        pointerEvents="none"
        style={[
          styles.loginButtonRing,
          variant === "dark" && styles.loginButtonRingDark,
          ringStyle,
        ]}
      />
      <Pressable
        onPress={handlePress}
        style={({ pressed }) => [
          variant === "lime" ? styles.primaryButton : styles.secondaryButton,
          pressed && styles.loginButtonPressed,
        ]}
      >
        {icon ? (
          <View style={styles.choiceIcon}>
            <Feather name={icon} size={18} color="#18181B" />
          </View>
        ) : null}
        {children}
        <Text style={variant === "lime" ? styles.buttonArrow : styles.buttonArrowDark}>→</Text>
      </Pressable>
    </View>
  );
}
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
    <Pressable
      onPress={onPress}
      style={[styles.pill, active && styles.pillActive]}
    >
      <Text style={[styles.pillText, active && styles.pillTextActive]}>
        {label}
      </Text>
    </Pressable>
  );
}

export default function HomeScreen() {
  const { width } = useWindowDimensions();
  const [role, setRole] = useState<Role | null>(null);
  const [loginRole, setLoginRole] = useState<Role | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("Todos");
  const [budgetFilter, setBudgetFilter] = useState<"todos" | BudgetStatus>(
    "todos",
  );
  const [budgets, setBudgets] = useState(initialBudgets);
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [attachmentUri, setAttachmentUri] = useState<string | null>(null);
  const suggestion = useMemo(() => findSuggestion(query), [query]);
  const filteredServices = useMemo(() => {
    const normalizedQuery = normalize(query);
    const searchTerm =
      suggestion && normalizedQuery.length > 0 ? suggestion : normalizedQuery;
    return services.filter((service) => {
      const matchesCategory =
        category === "Todos" || service.category === category;
      const searchable = normalize(
        `${service.title} ${service.category} ${service.provider} ${service.description}`,
      );
      return (
        matchesCategory && (!searchTerm || searchable.includes(searchTerm))
      );
    });
  }, [category, query, suggestion]);
  function login(selectedRole: Role) {
    if (!email.trim() || !password.trim()) {
      Alert.alert(
        "Campos obrigatórios",
        "Informe seu e-mail e sua senha para continuar.",
      );
      return;
    }
    setRole(selectedRole);
  }
  function updateBudget(id: string, status: BudgetStatus) {
    setBudgets((current) =>
      current.map((budget) =>
        budget.id === id ? { ...budget, status } : budget,
      ),
    );
  }
  function openService(service: Service) {
    setAttachmentUri(null);
    setSelectedService(service);
  }
  async function attachImage() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert(
        "Permissão necessária",
        "Permita o acesso às fotos para anexar uma imagem.",
      );
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      quality: 0.8,
    });
    if (!result.canceled) setAttachmentUri(result.assets[0].uri);
  }

  if (!role)
    return (
      <ScrollView
        contentContainerStyle={styles.loginPage}
        keyboardShouldPersistTaps="handled"
      >
        <View pointerEvents="none" style={[styles.loginOrb, styles.loginOrbMint]} />
        <View pointerEvents="none" style={[styles.loginOrb, styles.loginOrbBlue]} />
        <View pointerEvents="none" style={[styles.loginOrb, styles.loginOrbPeach]} />
        <View style={[styles.loginLayout, width < 760 && styles.loginLayoutMobile]}>
          <View style={[styles.loginIntro, width < 760 && styles.loginIntroMobile]}>
            <Logo />
            <Text style={styles.eyebrow}>PLATAFORMA DE SERVIÇOS</Text>
            <Text style={[styles.loginTitle, width < 760 && styles.loginTitleMobile]}>Encontre quem resolve.</Text>
            <Text style={[styles.loginSubtitle, width < 760 && styles.loginSubtitleMobile]}>
              Conecte clientes a profissionais confiáveis para fazer acontecer.
            </Text>
            <View style={styles.loginTrust}>
              <Feather name="shield" size={16} color="#4F7D6B" />
              <Text style={styles.loginTrustText}>Profissionais avaliados pela comunidade</Text>
            </View>
          </View>
          <View style={[styles.loginCard, width < 760 && styles.loginCardMobile]}>
            {!loginRole ? (
              <>
                <Text style={styles.cardTitle}>Como você vai usar?</Text>
                <Text style={styles.loginChoiceSubtitle}>
                  Escolha seu perfil para continuar.
                </Text>
                <LoginActionButton
                  variant="lime"
                  icon="user"
                  actionDelay={220}
                  onPress={() => setLoginRole("cliente")}
                >
                  <Text style={styles.primaryButtonText}>Sou cliente</Text>
                </LoginActionButton>
                <LoginActionButton
                  variant="dark"
                  icon="briefcase"
                  actionDelay={220}
                  onPress={() => setLoginRole("profissional")}
                >
                  <Text style={styles.secondaryButtonText}>Sou profissional</Text>
                </LoginActionButton>
              </>
            ) : (
              <>
                <Pressable
                  style={styles.backChoice}
                  onPress={() => setLoginRole(null)}
                >
                  <Feather name="arrow-left" size={16} color="#71717A" />
                  <Text style={styles.backChoiceText}>Trocar perfil</Text>
                </Pressable>
                <Text style={styles.cardTitle}>
                  {loginRole === "cliente"
                    ? "Acesse como cliente"
                    : "Acesse como profissional"}
                </Text>
                <Text style={styles.label}>E-mail</Text>
                <TextInput
                  value={email}
                  onChangeText={setEmail}
                  placeholder="seu@email.com"
                  placeholderTextColor="#71717A"
                  style={styles.input}
                  autoCapitalize="none"
                  keyboardType="email-address"
                />
                <Text style={styles.label}>Senha</Text>
                <TextInput
                  value={password}
                  onChangeText={setPassword}
                  placeholder="Digite sua senha"
                  placeholderTextColor="#71717A"
                  style={styles.input}
                  secureTextEntry
                />
                <LoginActionButton variant="lime" onPress={() => login(loginRole)}>
                  <Text style={styles.primaryButtonText}>Entrar</Text>
                </LoginActionButton>
                <Text style={styles.demoText}>
                  Use qualquer e-mail e senha para visualizar a demonstração.
                </Text>
              </>
            )}
          </View>
        </View>
      </ScrollView>
    );

  if (role === "cliente") {
    const trending = services.filter((service) => service.trending);
    const recent = services.filter((service) => service.recent);
    return (
      <View style={styles.page}>
        <View style={styles.header}>
          <Logo />
          <View style={styles.headerActions}>
            <Text style={styles.headerRole}>CLIENTE</Text>
            <Pressable style={styles.logoutButton} hitSlop={12} onPress={() => setRole(null)}>
              <Feather name="log-out" size={15} color="#71717A" />
              <Text style={styles.logout}>Sair</Text>
            </Pressable>
          </View>
        </View>
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.overline}>CATÁLOGO DE SERVIÇOS</Text>
          <Text style={styles.pageTitle}>O que você precisa resolver?</Text>
          <Text style={styles.pageSubtitle}>
            Pesquise um serviço ou explore as opções mais procuradas.
          </Text>
          <View style={styles.searchBox}>
            <Feather
              name="search"
              size={19}
              color="#18181B"
              style={styles.searchIcon}
            />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Ex.: pintor, eletricista, limpeza"
              placeholderTextColor="#71717A"
              style={styles.searchInput}
            />
            <Pressable onPress={() => setQuery("")}>
              <Text style={styles.clear}>{query ? "Limpar" : ""}</Text>
            </Pressable>
          </View>
          {suggestion ? (
            <Pressable
              style={styles.suggestion}
              onPress={() => setQuery(suggestion)}
            >
              <Text style={styles.suggestionText}>
                Você quis dizer{" "}
                <Text style={styles.suggestionStrong}>{suggestion}</Text>?
              </Text>
              <Text style={styles.suggestionAction}>Usar termo</Text>
            </Pressable>
          ) : null}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.categoryRow}
          >
            {categories.map((item) => (
              <Pill
                key={item}
                label={item}
                active={category === item}
                onPress={() => setCategory(item)}
              />
            ))}
          </ScrollView>
          {query || category !== "Todos" ? (
            <ServiceList
              items={filteredServices}
                onSelect={openService}
              title={`Resultados (${filteredServices.length})`}
            />
          ) : (
            <>
              <ServiceRail
                title="Em alta agora"
                items={trending}
                onSelect={openService}
              />
              <ServiceList
                title="Adicionados recentemente"
                items={recent}
                onSelect={openService}
              />
            </>
          )}
        </ScrollView>
        <Modal
          visible={Boolean(selectedService)}
          transparent
          animationType="slide"
          onRequestClose={() => setSelectedService(null)}
        >
          <View style={styles.modalBackdrop}>
            <View style={styles.modalCard}>
              <Text style={styles.modalEyebrow}>SOLICITAR ORÇAMENTO</Text>
              <Text style={styles.modalTitle}>{selectedService?.title}</Text>
              <Text style={styles.modalProvider}>
                {selectedService?.provider} · a partir de{" "}
                {selectedService?.price}
              </Text>
              <TextInput
                multiline
                placeholder="Conte um pouco sobre o que você precisa"
                placeholderTextColor="#71717A"
                style={[styles.input, styles.messageInput]}
              />
              <Pressable style={styles.attachButton} onPress={attachImage}>
                <Feather name="paperclip" size={17} color="#18181B" />
                <Text style={styles.attachText}>{attachmentUri ? "Imagem anexada" : "Anexar imagem"}</Text>
              </Pressable>
              {attachmentUri ? <Image source={{ uri: attachmentUri }} style={styles.attachmentPreview} /> : null}
              <View style={styles.modalActions}>
                <Pressable
                  style={styles.cancelButton}
                  onPress={() => {
                    setAttachmentUri(null);
                    setSelectedService(null);
                  }}
                >
                  <Text style={styles.cancelText}>Cancelar</Text>
                </Pressable>
                <Pressable
                  style={styles.primaryButtonSmall}
                  onPress={() => {
                    setAttachmentUri(null);
                    setSelectedService(null);
                    Alert.alert(
                      "Solicitação enviada",
                      "O profissional recebeu seu pedido.",
                    );
                  }}
                >
                  <Text style={styles.primaryButtonText}>Enviar pedido</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>
      </View>
    );
  }

  const visibleBudgets = budgets.filter(
    (budget) => budgetFilter === "todos" || budget.status === budgetFilter,
  );
  const counts = {
    solicitado: budgets.filter((budget) => budget.status === "solicitado")
      .length,
    pendente: budgets.filter((budget) => budget.status === "pendente").length,
    realizado: budgets.filter((budget) => budget.status === "realizado").length,
  };
  return (
    <View style={styles.page}>
      <View style={styles.header}>
        <Logo />
        <View style={styles.headerActions}>
          <Text style={styles.headerRoleGreen}>PROFISSIONAL</Text>
          <Pressable style={styles.logoutButton} hitSlop={12} onPress={() => setRole(null)}>
            <Feather name="log-out" size={15} color="#71717A" />
            <Text style={styles.logout}>Sair</Text>
          </Pressable>
        </View>
      </View>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.overlineGreen}>PAINEL DO PROFISSIONAL</Text>
        <Text style={styles.pageTitle}>Olá, profissional.</Text>
        <Text style={styles.pageSubtitle}>
          Acompanhe seus pedidos e mantenha sua agenda em movimento.
        </Text>
        <View style={styles.metricGrid}>
          <Metric label="Solicitados" value={counts.solicitado} tone="blue" />
          <Metric label="Pendentes" value={counts.pendente} tone="orange" />
          <Metric label="Realizados" value={counts.realizado} tone="green" />
          <Metric label="Este mês" value="R$ 1.840" tone="dark" wide />
        </View>
        <Pressable
          style={styles.greenButton}
          onPress={() =>
            Alert.alert(
              "Em breve",
              "A criação de orçamentos será conectada ao backend depois.",
            )
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
          {(
            [
              "todos",
              "solicitado",
              "pendente",
              "realizado",
              "recusado",
            ] as const
          ).map((item) => (
            <Pill
              key={item}
              label={
                item === "todos"
                  ? "Todos"
                  : item[0].toUpperCase() + item.slice(1)
              }
              active={budgetFilter === item}
              onPress={() => setBudgetFilter(item)}
            />
          ))}
        </ScrollView>
        {visibleBudgets.map((budget) => (
          <BudgetCard key={budget.id} budget={budget} onUpdate={updateBudget} />
        ))}
      </ScrollView>
    </View>
  );
}

function ServiceList({
  title,
  items,
  onSelect,
}: {
  title: string;
  items: Service[];
  onSelect: (service: Service) => void;
}) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {items.length ? (
        items.map((service) => (
          <ServiceCard key={service.id} service={service} onSelect={onSelect} />
        ))
      ) : (
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>Nenhum serviço encontrado</Text>
          <Text style={styles.emptyText}>
            Tente uma categoria ou termo mais amplo.
          </Text>
        </View>
      )}
    </View>
  );
}
function ServiceRail({
  title,
  items,
  onSelect,
}: {
  title: string;
  items: Service[];
  onSelect: (service: Service) => void;
}) {
  const railRef = useRef<ScrollView>(null);
  const [railOffset, setRailOffset] = useState(0);
  const railStep = 204;
  const maxRailOffset = Math.max(0, (items.length - 1) * railStep);
  const moveRail = (direction: number) => {
    const nextOffset = Math.max(0, Math.min(maxRailOffset, railOffset + direction * railStep));
    setRailOffset(nextOffset);
    railRef.current?.scrollTo({ x: nextOffset, animated: true });
  };

  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>{title}</Text>
        <View style={styles.arrowGroup}>
          <Pressable
            style={[styles.arrowButton, railOffset === 0 && styles.arrowButtonDisabled]}
            disabled={railOffset === 0}
            onPress={() => moveRail(-1)}
            accessibilityLabel="Ver serviços anteriores"
          >
            <Feather name="arrow-left" size={17} color="#18181B" />
          </Pressable>
          <Pressable
            style={[styles.arrowButton, railOffset >= maxRailOffset && styles.arrowButtonDisabled]}
            disabled={railOffset >= maxRailOffset}
            onPress={() => moveRail(1)}
            accessibilityLabel="Ver mais serviços em alta"
          >
            <Feather name="arrow-right" size={17} color="#18181B" />
          </Pressable>
        </View>
      </View>
      <ScrollView ref={railRef} horizontal showsHorizontalScrollIndicator={false}>
        {items.map((service) => (
          <Pressable
            key={service.id}
            style={styles.serviceRailCard}
            onPress={() => onSelect(service)}
          >
            <Text style={styles.railCategory}>{service.category}</Text>
            <Text style={styles.railTitle}>{service.title}</Text>
            <Text style={styles.railProvider}>{service.provider}</Text>
            <Text style={styles.railPrice}>{service.price}</Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}
function ServiceCard({
  service,
  onSelect,
}: {
  service: Service;
  onSelect: (service: Service) => void;
}) {
  return (
    <Pressable style={styles.serviceCard} onPress={() => onSelect(service)}>
      <View style={styles.cardTop}>
        <Text style={styles.serviceCategory}>{service.category}</Text>
        <Text style={styles.rating}>Nota {service.rating}</Text>
      </View>
      <Text style={styles.serviceTitle}>{service.title}</Text>
      <Text style={styles.provider}>{service.provider}</Text>
      <Text style={styles.description}>{service.description}</Text>
      <View style={styles.serviceBottom}>
        <Text style={styles.price}>A partir de {service.price}</Text>
        <Text style={styles.link}>Ver serviço →</Text>
      </View>
    </Pressable>
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
    <View
      style={[
        styles.metric,
        styles[`metric${tone}`],
        wide && styles.metricWide,
      ]}
    >
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

const legacyStyles = StyleSheet.create({
  page: { flex: 1, backgroundColor: "#F4F3EF" },
  content: { padding: 24, paddingBottom: 48 },
  header: {
    height: 76,
    paddingHorizontal: 24,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#F4F3EF",
    borderBottomWidth: 1,
    borderBottomColor: "#E3E1DB",
  },
  logo: { flexDirection: "row", alignItems: "center" },
  logoMark: {
    backgroundColor: "#E96745",
    color: "#FFF",
    width: 30,
    height: 30,
    borderRadius: 8,
    textAlign: "center",
    fontSize: 22,
    fontWeight: "800",
    lineHeight: 31,
  },
  logoText: {
    color: "#1F2928",
    fontSize: 22,
    fontWeight: "800",
    marginLeft: 8,
    letterSpacing: -0.6,
  },
  headerActions: { flexDirection: "row", alignItems: "center", gap: 18 },
  headerRole: {
    color: "#1D7790",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1,
  },
  headerRoleGreen: {
    color: "#37826A",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1,
  },
  logout: { color: "#6E756F", fontSize: 13, fontWeight: "700" },
  overline: {
    color: "#1D7790",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.4,
    marginTop: 22,
  },
  overlineGreen: {
    color: "#37826A",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.4,
    marginTop: 22,
  },
  pageTitle: {
    color: "#1F2928",
    fontSize: 30,
    fontWeight: "800",
    letterSpacing: -0.8,
    marginTop: 8,
  },
  pageSubtitle: {
    color: "#6E756F",
    fontSize: 15,
    lineHeight: 22,
    marginTop: 8,
    maxWidth: 560,
  },
  searchBox: {
    height: 54,
    backgroundColor: "#FFF",
    borderWidth: 1,
    borderColor: "#DCDDD8",
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 15,
    marginTop: 24,
  },
  searchIcon: {
    color: "#E96745",
    fontSize: 29,
    marginRight: 10,
    lineHeight: 30,
  },
  searchInput: { flex: 1, color: "#1F2928", fontSize: 14 },
  clear: { color: "#1D7790", fontSize: 12, fontWeight: "700" },
  suggestion: {
    backgroundColor: "#FFF2D9",
    borderRadius: 10,
    padding: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 8,
  },
  suggestionText: { color: "#725B32", fontSize: 13 },
  suggestionStrong: { fontWeight: "800", textDecorationLine: "underline" },
  suggestionAction: { color: "#A26421", fontSize: 12, fontWeight: "800" },
  categoryRow: { marginTop: 18, flexGrow: 0 },
  pill: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 20,
    backgroundColor: "#E8E7E1",
    marginRight: 8,
  },
  pillActive: { backgroundColor: "#1F2928" },
  pillText: { color: "#6E756F", fontSize: 12, fontWeight: "700" },
  pillTextActive: { color: "#FFF" },
  section: { marginTop: 28 },
  sectionTitle: {
    color: "#1F2928",
    fontSize: 19,
    fontWeight: "800",
    marginBottom: 13,
  },
  serviceRailCard: {
    backgroundColor: "#1F2928",
    borderRadius: 12,
    padding: 17,
    width: 190,
    marginRight: 12,
  },
  railCategory: {
    color: "#F5B45F",
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  railTitle: { color: "#FFF", fontSize: 16, fontWeight: "800", marginTop: 17 },
  railProvider: { color: "#B8C4BF", fontSize: 12, marginTop: 5 },
  railPrice: {
    color: "#8BD0B5",
    fontSize: 14,
    fontWeight: "800",
    marginTop: 22,
  },
  serviceCard: {
    backgroundColor: "#FFF",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E2E1DB",
    padding: 16,
    marginBottom: 11,
  },
  cardTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  serviceCategory: {
    color: "#1D7790",
    backgroundColor: "#E2F0F2",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 5,
    fontSize: 10,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  rating: { color: "#A26421", fontSize: 12, fontWeight: "700" },
  serviceTitle: {
    color: "#1F2928",
    fontSize: 17,
    fontWeight: "800",
    marginTop: 10,
  },
  provider: { color: "#6E756F", fontSize: 13, marginTop: 3 },
  description: {
    color: "#646B66",
    fontSize: 13,
    lineHeight: 19,
    marginTop: 10,
  },
  serviceBottom: {
    borderTopWidth: 1,
    borderTopColor: "#EEEDE8",
    marginTop: 14,
    paddingTop: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  price: { color: "#37826A", fontSize: 13, fontWeight: "800" },
  link: { color: "#1D7790", fontSize: 12, fontWeight: "800" },
  empty: {
    padding: 24,
    borderWidth: 1,
    borderColor: "#DCDDD8",
    borderRadius: 12,
    alignItems: "center",
  },
  emptyTitle: { color: "#1F2928", fontWeight: "800" },
  emptyText: { color: "#6E756F", fontSize: 13, marginTop: 5 },
  metricGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    gap: 9,
    marginTop: 24,
  },
  metric: {
    width: "31.5%",
    minHeight: 92,
    borderRadius: 12,
    padding: 14,
    justifyContent: "space-between",
  },
  metricWide: { width: "100%", minHeight: 82 },
  metricblue: { backgroundColor: "#DCEEF1" },
  metricorange: { backgroundColor: "#F8E8D2" },
  metricgreen: { backgroundColor: "#DCEDE3" },
  metricdark: { backgroundColor: "#1F2928" },
  metricLabel: { color: "#68736D", fontSize: 11, fontWeight: "800" },
  metricValue: { color: "#1F2928", fontSize: 25, fontWeight: "800" },
  greenButton: {
    backgroundColor: "#37826A",
    padding: 16,
    borderRadius: 10,
    alignItems: "center",
    marginTop: 17,
  },
  greenButtonText: { color: "#FFF", fontSize: 14, fontWeight: "800" },
  budgetCard: {
    backgroundColor: "#FFF",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E2E1DB",
    padding: 16,
    marginBottom: 11,
  },
  budgetClient: { color: "#1F2928", fontSize: 16, fontWeight: "800" },
  budgetDate: { color: "#8B9290", fontSize: 12, marginTop: 3 },
  status: {
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 6,
    fontSize: 10,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  statussolicitado: { color: "#1D7790", backgroundColor: "#E2F0F2" },
  statuspendente: { color: "#A26421", backgroundColor: "#F8E8D2" },
  statusrealizado: { color: "#37826A", backgroundColor: "#DCEDE3" },
  statusrecusado: { color: "#9B554B", backgroundColor: "#F5DFDC" },
  budgetService: {
    color: "#4F5954",
    fontSize: 14,
    fontWeight: "700",
    marginTop: 14,
  },
  budgetBottom: {
    borderTopWidth: 1,
    borderTopColor: "#EEEDE8",
    marginTop: 14,
    paddingTop: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  budgetValue: { color: "#1F2928", fontSize: 16, fontWeight: "800" },
  actionRow: { flexDirection: "row", gap: 15 },
  actionText: { color: "#37826A", fontSize: 12, fontWeight: "800" },
  actionTextMuted: { color: "#9B554B", fontSize: 12, fontWeight: "800" },
  loginPage: {
    flexGrow: 1,
    backgroundColor: "#1F2928",
    padding: 24,
    justifyContent: "center",
  },
  loginIntro: { marginBottom: 30 },
  eyebrow: {
    color: "#F5B45F",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.5,
    marginTop: 44,
  },
  loginTitle: {
    color: "#FFF",
    fontSize: 39,
    lineHeight: 43,
    fontWeight: "800",
    marginTop: 12,
    maxWidth: 390,
  },
  loginSubtitle: {
    color: "#B8C4BF",
    fontSize: 15,
    lineHeight: 22,
    marginTop: 10,
    maxWidth: 390,
  },
  loginCard: {
    backgroundColor: "#FFF",
    borderRadius: 14,
    padding: 22,
    maxWidth: 500,
    width: "100%",
    alignSelf: "center",
  },
  cardTitle: {
    color: "#1F2928",
    fontSize: 20,
    fontWeight: "800",
    marginBottom: 16,
  },
  label: {
    color: "#4F5954",
    fontSize: 12,
    fontWeight: "800",
    marginBottom: 7,
    marginTop: 12,
  },
  input: {
    backgroundColor: "#F4F3EF",
    borderWidth: 1,
    borderColor: "#DCDDD8",
    borderRadius: 9,
    minHeight: 46,
    paddingHorizontal: 13,
    color: "#1F2928",
    fontSize: 14,
  },
  roleLabel: {
    color: "#8B9290",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.2,
    marginTop: 22,
    marginBottom: 9,
  },
  primaryButton: {
    backgroundColor: "#E96745",
    minHeight: 48,
    borderRadius: 9,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  primaryButtonSmall: {
    backgroundColor: "#E96745",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 9,
  },
  primaryButtonText: { color: "#FFF", fontSize: 14, fontWeight: "800" },
  buttonArrow: { color: "#FFF", fontSize: 20 },
  secondaryButton: {
    backgroundColor: "#E7F0EB",
    minHeight: 48,
    borderRadius: 9,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 9,
  },
  secondaryButtonText: { color: "#37826A", fontSize: 14, fontWeight: "800" },
  buttonArrowDark: { color: "#37826A", fontSize: 20 },
  demoText: {
    textAlign: "center",
    color: "#8B9290",
    fontSize: 11,
    marginTop: 17,
    lineHeight: 16,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(31, 41, 40, 0.6)",
    justifyContent: "flex-end",
  },
  modalCard: {
    backgroundColor: "#FFF",
    padding: 24,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
  },
  modalEyebrow: {
    color: "#1D7790",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.2,
  },
  modalTitle: {
    color: "#1F2928",
    fontSize: 22,
    fontWeight: "800",
    marginTop: 9,
  },
  modalProvider: {
    color: "#6E756F",
    fontSize: 13,
    marginTop: 4,
    marginBottom: 18,
  },
  messageInput: { minHeight: 100, paddingTop: 13, textAlignVertical: "top" },
  modalActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 9,
    marginTop: 16,
  },
  cancelButton: { paddingHorizontal: 16, paddingVertical: 12 },
  cancelText: { color: "#6E756F", fontSize: 13, fontWeight: "800" },
});
