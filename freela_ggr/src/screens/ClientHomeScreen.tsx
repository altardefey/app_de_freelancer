import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  AppState,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";
import { router, useFocusEffect } from "expo-router";
import Feather from "@expo/vector-icons/Feather";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LocationFields } from "../components/LocationFields";
import { useSession } from "../context/SessionContext";
import {
  listBudgets,
  updateBudgetStatus,
  listServices,
  createBudget,
} from "../data/remote";
import { buildCatalogDictionary, serviceCategories } from "../data/catalog";
import { distance, normalize } from "../utils/searchTools";
import type { Budget, BudgetStatus, Service } from "../types/app";
import { Button, Empty, Field, Notice, Page } from "../ui/components";
import { fonts } from "../ui/design";
import { ProfessionalDetails } from "../components/ProfileSettingsForm";
import { loadProfessionalCard, loadProfileSettings, type PublicProfessionalProfile } from "../data/profileSettings";
import { PortfolioImage } from "../components/ServicePublisher";
import Animated, { FadeInDown, ReduceMotion, useAnimatedStyle, useReducedMotion, useSharedValue, withTiming, type SharedValue } from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";
import { Shell } from "../ui/Shell";
import { useAppearance } from "../ui/Appearance";

export function ClientHomeScreen() {
  const { colors, ui } = useAppearance();
  const { user, location, setLocation } = useSession();
  const { width } = useWindowDimensions();
  const reduceMotion = useReducedMotion();
  const [avatar, setAvatar] = useState<string>();
  const pageScroll = useRef<ScrollView>(null);
  const [showUpdates, setShowUpdates] = useState(false);
  const [slide, setSlide] = useState(0);
  const coverPosition = useSharedValue(0);
  const [previewExamples, setPreviewExamples] = useState(false);
  useEffect(() => {
    setPreviewExamples(__DEV__ || (Platform.OS === "web" && ["localhost", "127.0.0.1"].includes(window.location.hostname)));
  }, []);
  const insets = useSafeAreaInsets();
  const [interests, setInterests] = useState<string[]>([]);
  const [interestsOnly, setInterestsOnly] = useState(false);
  const [professionalCard, setProfessionalCard] = useState<PublicProfessionalProfile | null>(null);
  const [remoteOnly, setRemoteOnly] = useState(false);
  const [services, setServices] = useState<Service[]>([]);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [responseError, setResponseError] = useState("");
  const [responding, setResponding] = useState<string | null>(null);
  const responseLock = useRef(false);
  const [query, setQuery] = useState("");
  const [searchPreview, setSearchPreview] = useState(true);
  const [category, setCategory] = useState("Todos");
  const [editLocation, setEditLocation] = useState(false);
  const [selectedSnapshot, setSelected] = useState<Service | null>(null);
  const selected = selectedSnapshot && (services.find((service) => service.id === selectedSnapshot.id) ?? selectedSnapshot);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [modalError, setModalError] = useState("");
  const [success, setSuccess] = useState("");
  const lock = useRef(false);
  const suggestion = useMemo(() => {
    const term = normalize(query);
    const dictionary = buildCatalogDictionary(services);
    if (term.length < 3 || dictionary.some((word) => word.includes(term)))
      return null;
    return (
      dictionary.reduce<{ word: string; score: number } | null>(
        (best, word) => {
          const score = distance(term, word);
          return score <= Math.max(2, Math.floor(term.length / 3)) &&
            (!best || score < best.score)
            ? { word, score }
            : best;
        },
        null,
      )?.word ?? null
    );
  }, [query, services]);
  async function load() {
    setLoading(true);
    setError("");
    try {
      const [s, b] = await Promise.all([listServices(), listBudgets()]);
      setBudgets(b);
      setServices(s);
    } catch {
      setError(
        "Não foi possível carregar os serviços. Confira sua conexão e tente novamente.",
      );
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    void load();
  }, []);
  useFocusEffect(useCallback(() => {
    let active = true;
    const interval = setInterval(() => {
      if (Platform.OS === "web" ? document.hidden : AppState.currentState !== "active") return;
      void listServices().then((items) => { if (active) setServices(items); }).catch(() => {});
    }, 20_000);
    return () => { active = false; clearInterval(interval); };
  }, []));
  useEffect(() => {
    if (!user?.id) return;
    let active = true;
    void loadProfileSettings(user.id).then((profile) => { if (active) { setInterests(profile.services ?? []); setAvatar(profile.avatar_path ?? undefined); } }).catch(() => {});
    return () => { active = false; };
  }, [user?.id]);
  useEffect(() => {
    let active = true;
    setProfessionalCard(null);
    if (selected?.providerId) void loadProfessionalCard(selected.providerId).then((profile) => { if (active) setProfessionalCard(profile); }).catch(() => {});
    return () => { active = false; };
  }, [selected?.providerId]);
  async function send() {
    if (lock.current || !selected || selected.unavailable) return;
    if (!drafts[selected.id]?.trim()) return setModalError("Descreva o serviço de que você precisa.");
    lock.current = true;
    setBusy(true);
    setModalError("");
    try {
      const request = await createBudget({
        client: "Cliente do app",
        service: selected.title,
        serviceId: selected.id,
        value: selected.price,
        professionalId: selected.providerId,
        status: "solicitado",
        details: drafts[selected.id] ?? "",
        shareContact: true,
      });
      setBudgets((old) => [request, ...old]);
      setDrafts((old) => ({ ...old, [selected.id]: "" }));
      setSelected(null);
      setSuccess(
        "Pedido enviado. O profissional já pode consultar sua solicitação.",
      );
    } catch (failure) {
      setModalError(failure instanceof Error ? failure.message : "Não foi possível enviar. Tente novamente.");
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  async function respond(id: string, status: BudgetStatus) {
    if (responseLock.current) return;
    responseLock.current = true;
    setResponding(id);
    setResponseError("");
    try {
      await updateBudgetStatus(id, status);
      setBudgets(old => old.map(b => b.id === id ? { ...b, status } : b));
    } catch (failure) {
      setResponseError(failure instanceof Error ? failure.message : "Não foi possível atualizar o pedido. Tente novamente.");
    } finally {
      responseLock.current = false;
      setResponding(null);
    }
  }
  const statuses: Record<BudgetStatus, string> = { solicitado: "Pedido enviado", cotado: "Proposta recebida", aceito: "Aceito", em_andamento: "Em andamento", realizado: "Concluído", recusado: "Recusado", cancelado: "Cancelado" };
  const filtered = services.filter(
    (s) =>
      (category === "Todos" || s.category === category) &&
      (!interestsOnly || interests.some((interest) => [s.category, s.title].some((value) => normalize(value).includes(normalize(interest))))) &&
      (remoteOnly ? s.remote : s.remote || (
        (!location.uf || s.uf === location.uf) &&
        (!location.city || s.city === location.city) &&
        (!location.neighborhood || normalize(s.neighborhood) === normalize(location.neighborhood))
      )) &&
      (!query ||
        normalize(
          s.title + " " + s.category + " " + s.provider + " " + s.description,
        ).includes(suggestion ?? normalize(query))),
  );
  const categoryCounts = new Map<string, number>();
  for (const service of query.trim() ? filtered : services) {
    if (service.category) categoryCounts.set(service.category, (categoryCounts.get(service.category) ?? 0) + 1);
  }
  const availableCategories = [...categoryCounts].sort((a, b) => b[1] - a[1]).slice(0, 8);
  const closeSearchPreview = () => {
    setSearchPreview(false);
    Keyboard.dismiss();
  };

  const featured = useMemo(() => {
    const preferred = new Set(interests.map(normalize));
    const score = (service: Service) => Number(preferred.has(normalize(service.category))) * 6
      + Number(!!location.city && normalize(service.city) === normalize(location.city) && (!location.uf || service.uf === location.uf)) * 8
      + Number(!!location.neighborhood && normalize(service.neighborhood) === normalize(location.neighborhood)) * 2
      + Number(!!service.portfolioPaths?.length) * 2 + Number(!!service.trending);
    const seen = new Set<string>();
    return [...services].sort((a, b) => score(b) - score(a)).filter((service) => {
      if (seen.has(service.category)) return false;
      seen.add(service.category);
      return true;
    }).slice(0, 4);
  }, [services, interests, location.city, location.uf, location.neighborhood]);
  const canRotate = featured.length > 1 && !reduceMotion && !query && category === "Todos" && !remoteOnly && !interestsOnly && !selected && !showUpdates;
  useFocusEffect(useCallback(() => {
    if (!canRotate) return;
    const timer = setInterval(() => {
      if (Platform.OS === "web" ? document.hidden : AppState.currentState !== "active") return;
      setSlide((current) => current + 1);
    }, 3000);
    return () => clearInterval(timer);
  }, [canRotate, featured.length]));
  const featuredIndex = slide % Math.max(1, featured.length);
  useEffect(() => {
    coverPosition.value = reduceMotion ? slide : withTiming(slide, { duration: 420 });
  }, [coverPosition, reduceMotion, slide]);
  const discovery = !query && category === "Todos" && !remoteOnly && !interestsOnly;
  const proposals = budgets.filter((budget) => budget.status === "cotado").length;
  const openService = (service: Service) => {
    setSelected(service);
    setModalError("");
  };
  const avatarFallback = <Feather name="user" size={20} color={colors.purple} />;

  return (
    <Shell actions={<View style={ui.row}>
      <Pressable accessibilityRole="button" accessibilityLabel={proposals ? "Notificações, " + proposals + " propostas para revisar" : "Notificações"} accessibilityState={{ expanded: showUpdates }} onPress={() => { closeSearchPreview(); setShowUpdates(true); }} style={{ width: 44, height: 44, justifyContent: "center", alignItems: "center" }}>
        <Feather name="bell" size={22} color={colors.ink} />
        {!!proposals && <View style={{ position: "absolute", top: 7, right: 7, width: 9, height: 9, borderRadius: 5, backgroundColor: colors.purple }} />}
      </Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel="Abrir minha conta" onPress={() => router.push("/conta")} style={{ width: 44, height: 44, borderRadius: 22, overflow: "hidden", backgroundColor: colors.lavender, justifyContent: "center", alignItems: "center" }}>
        {avatar ? <PortfolioImage path={avatar} avatar style={{ width: 44, height: 44 }} fallback={avatarFallback} /> : avatarFallback}
      </Pressable>
    </View>}>
      <View style={{ backgroundColor: colors.white, borderBottomWidth: 1, borderBottomColor: colors.line }}>
        <View style={{ width: "100%", maxWidth: 1080, alignSelf: "center", paddingHorizontal: 24, gap: 4 }}>
          <View style={[ui.row, { backgroundColor: colors.lavender, borderRadius: 14, paddingLeft: 14, minHeight: 50 }]}>
            <Feather name="search" size={20} color={colors.muted} />
            <TextInput accessibilityLabel="Qual serviço você procura?" placeholder="Buscar no Freela" value={query} onFocus={() => setSearchPreview(true)} onSubmitEditing={closeSearchPreview} onKeyPress={({ nativeEvent }) => { if (nativeEvent.key === "Escape") closeSearchPreview(); }} onChangeText={(value) => { setQuery(value); pageScroll.current?.scrollTo({ y: 0, animated: false }); }} placeholderTextColor={colors.muted} returnKeyType="search" style={{ flex: 1, minHeight: 50, paddingRight: 12, color: colors.ink, fontFamily: fonts.regular, fontSize: 16 }} />
            {!!query && <Pressable accessibilityRole="button" accessibilityLabel="Limpar busca" onPress={() => setQuery("")} style={{ width: 44, height: 44, justifyContent: "center", alignItems: "center" }}><Feather name="x" size={19} color={colors.ink} /></Pressable>}
          </View>
          <SearchOverview open={searchPreview} onClose={closeSearchPreview} categories={availableCategories} loading={loading}
            onPick={(item) => {
              setCategory(item);
              setRemoteOnly(false);
              setInterestsOnly(false);
              setQuery("");
              closeSearchPreview();
              pageScroll.current?.scrollTo({ y: 0, animated: false });
            }} />
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 18 }}
        >
          <Pressable accessibilityRole="checkbox" accessibilityLabel="Só serviços remotos" accessibilityState={{ checked: remoteOnly }} aria-checked={remoteOnly} onPress={() => { setRemoteOnly(!remoteOnly); setCategory("Todos"); setQuery(""); }} style={{ minHeight: 44, justifyContent: "center" }}>
            <View style={[ui.chip, { minHeight: 30, paddingHorizontal: 10 }, remoteOnly && ui.chipActive]}>
              <Text style={[ui.label, { fontSize: 13 }, remoteOnly && { color: colors.white }]}>Remotos</Text>
            </View>
          </Pressable>
          {!!interests.length && <Pressable accessibilityRole="checkbox" aria-checked={interestsOnly} onPress={() => { setInterestsOnly(!interestsOnly); setCategory("Todos"); setQuery(""); }} style={[ui.chip, interestsOnly && ui.chipActive]}>
            <Text style={[ui.label, interestsOnly && { color: colors.white }]}>Meus interesses</Text>
          </Pressable>}
          {serviceCategories.map((item) => (
            <Pressable
              key={item}
              accessibilityRole="button"
              accessibilityState={{ selected: category === item }}
              onPress={() => { setCategory(item); closeSearchPreview(); }}
              style={{ minHeight: 44, justifyContent: "center", borderBottomWidth: 3, borderBottomColor: category === item ? colors.purple : "transparent" }}
            >
              <Text
                style={[ui.label, category === item && { color: colors.purple }]}
              >
                {item}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
        </View>
      </View>
      <Page scrollRef={pageScroll}>
        {suggestion ? <Button title={`Buscar por “${suggestion}”`} secondary onPress={() => setQuery(suggestion)} /> : null}
        <Pressable
          accessibilityRole="button"
          onPress={() => setEditLocation(!editLocation)}
          accessibilityState={{ expanded: editLocation }}
          style={({ pressed }) => [ui.between, { minHeight: 48, flexWrap: "nowrap", paddingHorizontal: 12, backgroundColor: colors.lavender, borderRadius: 10, opacity: pressed ? 0.75 : 1 }]}
        >
          <View style={[ui.row, { flex: 1 }]}>
            <Feather name="map-pin" color={colors.purple} size={20} />
            <Text style={[ui.body, { flex: 1 }]}>
              {[location.neighborhood, location.city, location.uf]
                .filter(Boolean)
                .join(", ") || "Escolha sua região"}
            </Text>
          </View>
          <Text style={ui.label}>{editLocation ? "Fechar" : "Alterar"}</Text>
        </Pressable>
        {editLocation ? (
          <View style={ui.card}>
            <LocationFields value={location} onChange={setLocation} compact />
          </View>
        ) : null}
        {discovery && featured.length > 0 && <View style={{ gap: 8 }}>
          <View style={ui.between}>
            <Text accessibilityRole="header" style={ui.heading}>Em destaque</Text>
            <Text style={ui.small}>{featuredIndex + 1} de {featured.length}</Text>
          </View>
          <View style={{ height: 224, justifyContent: "center", alignItems: "center", overflow: "hidden" }}>
            {featured.map((service, index) => <FeaturedCover key={service.id} service={service} index={index} count={featured.length} position={coverPosition} active={featuredIndex === index} onPress={() => openService(service)} />)}
          </View>
          {featured.length > 1 && <View style={[ui.row, { justifyContent: "center", gap: 0 }]}>
            {featured.map((service, index) => (
              <Pressable key={service.id} accessibilityRole="button" accessibilityLabel={"Destaque " + (index + 1)} accessibilityState={{ selected: index === featuredIndex }} onPress={() => setSlide((current) => current - current % featured.length + index)} style={{ width: 44, height: 44, alignItems: "center", justifyContent: "center" }}>
                <View style={{ width: index === featuredIndex ? 18 : 7, height: 7, borderRadius: 4, backgroundColor: index === featuredIndex ? colors.purple : colors.muted }} />
              </Pressable>
            ))}
          </View>}
        </View>}
        {success ? (
          <Text
            accessibilityRole="alert"
            style={[ui.card, ui.body, { color: colors.success }]}
          >
            {success}
          </Text>
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
        <View style={ui.between}>
          <Text style={ui.heading}>
            {query ? "Resultados da busca" : "Serviços na sua região"}
          </Text>
          <Text style={ui.small}>{filtered.length} {filtered.length === 1 ? "opção" : "opções"}</Text>
        </View>
        {loading ? (
          <ActivityIndicator color={colors.purple} />
        ) : !filtered.length ? (
          <Empty
            title="Nenhum serviço encontrado"
            text="Tente outro serviço ou ajuste sua região para encontrar mais opções."
            icon="search"
          />
        ) : (
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
            {filtered.map((service) => (
              <Pressable key={service.id} accessibilityRole="button" accessibilityLabel={"Ver serviço " + service.title} onPress={() => openService(service)}
                style={({ pressed }) => ({ width: width >= 850 ? "32%" : "47.5%", gap: 6, paddingBottom: 10, opacity: pressed ? 0.75 : 1 })}>
                <View style={{ height: width >= 850 ? 180 : 124, borderRadius: 12, overflow: "hidden", backgroundColor: colors.lavender }}>
                  <ServiceCover service={service} />
                </View>
                <Text style={ui.small} numberOfLines={1}>{service.remote ? "Remoto" : service.category}</Text>
                <Text style={ui.label} numberOfLines={2}>{service.title}</Text>
                <Text style={ui.small} numberOfLines={1}>{service.provider}{service.providerPremium ? " · Freela+" : ""}</Text>
                <Text style={[ui.label, { color: colors.success }]} numberOfLines={2}>{service.price}</Text>
                {service.unavailable && <Text style={ui.small}>Indisponível no momento</Text>}
              </Pressable>
            ))}
          </View>
        )}
      </Page>
      <Modal visible={showUpdates} onRequestClose={() => setShowUpdates(false)} animationType={reduceMotion ? "none" : "slide"}>
        <SafeAreaView style={ui.page}>
          <Page>
            <View style={ui.between}>
              <Text accessibilityRole="header" style={ui.title}>Notificações</Text>
              <Pressable accessibilityRole="button" accessibilityLabel="Fechar notificações" onPress={() => setShowUpdates(false)} style={{ width: 44, height: 44, alignItems: "center", justifyContent: "center" }}>
                <Feather name="x" size={24} color={colors.ink} />
              </Pressable>
            </View>
            <Text style={ui.body}>Acompanhe suas propostas e pedidos.</Text>
            {!!responseError && <Notice>{responseError}</Notice>}
        {budgets.length > 0 ? <View style={{ gap: 16 }}>
          {budgets.map((b, index) => <NotificationLetter key={b.id} index={index} icon={b.status === "cotado" ? "file-text" : "bell"} label={statuses[b.status]}>
            <Text style={ui.heading}>{b.service}</Text>
            {b.details ? <Text style={ui.body}>{b.details}</Text> : null}
            {b.quoteAmount != null ? <Text style={ui.heading}>{b.value}</Text> : null}
            {b.delivery && <Text style={ui.body}>Prazo ou disponibilidade: {b.delivery}</Text>}
            {b.quoteMessage ? <Text style={ui.body}>{b.quoteMessage}</Text> : null}
            {b.status === "cotado" ? <>
              <Button title="Aceitar proposta" busy={responding === b.id} disabled={!!responding} onPress={() => void respond(b.id, "aceito")} />
              <Button title="Recusar proposta" secondary disabled={!!responding} onPress={() => void respond(b.id, "recusado")} />
            </> : null}
            {["solicitado", "cotado", "aceito"].includes(b.status) ? <Button title="Cancelar pedido" secondary disabled={!!responding} onPress={() => void respond(b.id, "cancelado")} /> : null}
          </NotificationLetter>)}
        </View> : previewExamples ? <View style={{ gap: 16 }}>
          <NotificationLetter index={0} icon="file-text" label="Exemplo de proposta"><Text style={ui.heading}>Pintura da sala</Text><Text style={ui.body}>Uma profissional enviou um orçamento para você revisar.</Text></NotificationLetter>
          <NotificationLetter index={1} icon="check-circle" label="Exemplo de atualização"><Text style={ui.heading}>Montagem de móveis</Text><Text style={ui.body}>O pedido foi recebido pelo profissional.</Text></NotificationLetter>
        </View> : <Empty title="Tudo em dia" text="As atualizações dos seus pedidos aparecem aqui." icon="bell" />}

          </Page>
        </SafeAreaView>
      </Modal>
      <Modal
        visible={!!selected}
        transparent
        animationType="slide"
        onRequestClose={() => !busy && setSelected(null)}
      >
        <KeyboardAvoidingView
          style={ui.modal}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
          <View style={ui.sheet}>
            <ScrollView
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{
                padding: 24,
                paddingBottom: Math.max(24, insets.bottom),
                gap: 20,
              }}
            >
              <View style={ui.between}>
                <Text style={ui.small}>Solicitar serviço</Text>
                <Pressable
                  disabled={busy}
                  accessibilityRole="button"
                  accessibilityLabel="Fechar serviço"
                  onPress={() => setSelected(null)}
                  style={{ padding: 12 }}
                >
                  <Feather name="x" size={22} color={colors.ink} />
                </Pressable>
              </View>
              <Text style={ui.title}>{selected?.title}</Text>
              <Text style={ui.body}>{selected?.provider}{selected?.providerPremium ? " · Freela+" : ""}</Text>
              {professionalCard && <>
                {professionalCard.avatar_path && <PortfolioImage path={professionalCard.avatar_path} avatar />}
                <ProfessionalDetails profile={professionalCard} />
              </>}
              <Text style={ui.heading}>{selected?.price}</Text>
              <Text style={ui.body}>{selected?.description}</Text>
              {selected?.remote && <Text style={ui.label}>Atendimento remoto, sem endereço</Text>}
              {!!selected?.portfolioPaths?.length && <View style={{ gap: 12 }}><Text style={ui.heading}>Portfólio</Text>{selected.portfolioPaths.map((path) => <PortfolioImage key={path} path={path} />)}</View>}
              {selected?.unavailable ? <Notice>Indisponível no momento. Este anúncio volta a aceitar pedidos no próximo mês.</Notice> : <>
              <Field
                label="Descreva o serviço de que você precisa"
                multiline
                maxLength={2000}
                editable={!busy}
                value={selected ? (drafts[selected.id] ?? "") : ""}
                onChangeText={(text) =>
                  selected &&
                  setDrafts((old) => ({ ...old, [selected.id]: text }))
                }
                placeholder="Conte os detalhes para o profissional."
              />
              <Text style={ui.small}>Ao enviar o pedido, seu WhatsApp cadastrado será usado pelo profissional para enviar o orçamento.</Text>
              {modalError ? <Notice>{modalError}</Notice> : null}
              <Button
                title="Enviar pedido"
                busy={busy}
                onPress={() => void send()}
              />
              <Text style={ui.small}>
                Você poderá aceitar ou recusar a proposta depois de recebê-la.
              </Text>
              </>}
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </Shell>
  );
}

const serviceIcons: Record<string, keyof typeof Feather.glyphMap> = {
  Pintura: "edit-3",
  Elétrica: "zap",
  Hidráulica: "droplet",
  Limpeza: "sun",
  Marcenaria: "layers",
  Refrigeração: "wind",
  "Edição de vídeo": "film",
  "Design gráfico": "pen-tool",
  "Arte digital": "monitor",
  "Arte tradicional": "feather",
};

function ServiceCover({ service }: { service: Service }) {
  const { colors } = useAppearance();
  const path = service.portfolioPaths?.[0];
  const fallback = (
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ flex: 1, width: "100%", justifyContent: "center", alignItems: "center", overflow: "hidden", backgroundColor: colors.lavender }}>
      <View style={{ position: "absolute", right: -25, bottom: -52, width: 155, height: 155, borderRadius: 78, borderWidth: 1, borderColor: colors.purple, opacity: 0.45 }} />
      <View style={{ position: "absolute", right: -9, bottom: -36, width: 123, height: 123, borderRadius: 62, borderWidth: 1, borderColor: colors.purple, opacity: 0.45 }} />
      <Feather name={serviceIcons[service.category] ?? "tool"} size={47} color={colors.purple} />
    </View>
  );
  return path ? <PortfolioImage path={path} style={{ width: "100%", height: "100%", borderRadius: 0 }} fallback={fallback} /> : fallback;
}

function FeaturedCover({ service, index, count, position, active, onPress }: {
  service: Service; index: number; count: number; position: SharedValue<number>; active: boolean; onPress: () => void;
}) {
  const { ui } = useAppearance();
  const { width } = useWindowDimensions();
  const spacing = Math.min(150, Math.max(58, (width - 48) * 0.18));
  const motion = useAnimatedStyle(() => {
    const half = count / 2;
    const delta = ((index - position.value + half) % count + count) % count - half;
    const distance = Math.abs(delta);
    return {
      zIndex: Math.round(100 - distance * 30),
      opacity: Math.max(0, Math.min(1, 2 - distance)),
      transform: [
        { perspective: 700 },
        { translateX: delta * spacing },
        { rotateY: Math.max(-36, Math.min(36, delta * -34)) + "deg" },
        { scale: Math.max(0.7, 1 - distance * 0.17) },
      ],
    };
  });
  return (
    <Animated.View pointerEvents={active ? "auto" : "none"} accessibilityElementsHidden={!active} importantForAccessibility={active ? "auto" : "no-hide-descendants"} aria-hidden={!active} style={[{ position: "absolute", width: count > 1 ? "76%" : "100%", maxWidth: 640 }, motion]}>
      <Pressable disabled={!active} accessibilityRole="button" accessibilityLabel={"Ver destaque: " + service.title} onPress={onPress}
        style={({ pressed }) => ({ height: 208, backgroundColor: "#1F1633", borderRadius: 18, overflow: "hidden", flexDirection: "row", opacity: pressed ? 0.85 : 1 })}>
        <View style={{ flex: 1.25, justifyContent: "space-between", padding: 16, gap: 8 }}>
          <Text style={ui.heroBody} numberOfLines={1}>{service.category}</Text>
          <Text style={[ui.heroTitle, { fontSize: 23, lineHeight: 26 }]} numberOfLines={3}>{service.title}</Text>
          <Text style={[ui.label, { color: "#9FE870" }]}>{service.unavailable ? "Indisponível no momento" : "Ver serviço"}</Text>
        </View>
        <View style={{ flex: 1, overflow: "hidden" }}><ServiceCover service={service} /></View>
      </Pressable>
    </Animated.View>
  );
}

function NotificationLetter({ index, icon, label, children }: {
  index: number; icon: keyof typeof Feather.glyphMap; label: string; children: React.ReactNode;
}) {
  const { colors, ui } = useAppearance();
  const angle = index % 2 ? "2deg" : "-2deg";
  return (
    <Animated.View entering={FadeInDown.duration(300).delay(Math.min(index, 4) * 55).reduceMotion(ReduceMotion.System)} style={{ paddingTop: 10, marginHorizontal: 6 }}>
      <View pointerEvents="none" style={{ position: "absolute", inset: 6, borderRadius: 18, backgroundColor: colors.lavender, borderWidth: 1, borderColor: colors.line, transform: [{ rotate: angle }] }} />
      <View style={[ui.card, { borderRadius: 18, gap: 10 }]}>
        <View style={ui.row}>
          <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: colors.lavender, alignItems: "center", justifyContent: "center" }}>
            <Feather name={icon} size={17} color={colors.purple} />
          </View>
          <Text style={[ui.label, { color: colors.purple }]}>{label}</Text>
        </View>
        {children}
      </View>
    </Animated.View>
  );
}

function SearchOverview({ open, categories, loading, onPick, onClose }: {
  open: boolean;
  categories: [string, number][];
  loading: boolean;
  onPick: (category: string) => void;
  onClose: () => void;
}) {
  const { colors, ui } = useAppearance();
  const measuredHeight = useSharedValue(0);
  const reveal = useAnimatedStyle(() => ({
    height: withTiming(open ? measuredHeight.value : 0, { duration: 210, reduceMotion: ReduceMotion.System }),
    opacity: withTiming(open ? 1 : 0, { duration: 170, reduceMotion: ReduceMotion.System }),
  }));

  return (
    <Animated.View pointerEvents={open ? "auto" : "none"} aria-hidden={!open} accessibilityElementsHidden={!open}
      importantForAccessibility={open ? "auto" : "no-hide-descendants"} style={[{ overflow: "hidden" }, reveal]}>
      <View onLayout={({ nativeEvent }) => { measuredHeight.value = nativeEvent.layout.height; }}
        style={{ position: "absolute", top: 0, left: 0, right: 0, paddingTop: 4 }}>
        <View style={[ui.card, { gap: 4, paddingVertical: 4, paddingHorizontal: 12, backgroundColor: colors.canvas }]}>
          <View style={ui.between}>
            <Text style={ui.label}>Serviços disponíveis</Text>
            <Pressable accessibilityRole="button" accessibilityLabel="Fechar prévia da busca" disabled={!open}
              onPress={onClose} style={{ width: 44, height: 44, alignItems: "center", justifyContent: "center" }}>
              <Feather name="chevron-up" size={18} color={colors.muted} />
            </Pressable>
          </View>
          {categories.length ? (
            <ScrollView horizontal keyboardShouldPersistTaps="always" showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 8, paddingBottom: 6 }}>
              {categories.map(([category, count]) => (
                <Pressable key={category} accessibilityRole="button"
                  accessibilityLabel={category + ", " + count + (count === 1 ? " serviço" : " serviços")}
                  onPress={() => onPick(category)} style={({ pressed }) => [ui.chip, ui.row, { paddingHorizontal: 10, opacity: pressed ? 0.65 : 1 }]}>
                  <Text style={ui.label}>{category}</Text>
                  <Text style={ui.small}>{count}</Text>
                </Pressable>
              ))}
            </ScrollView>
          ) : <Text style={[ui.small, { paddingBottom: 10 }]}>{loading ? "Carregando catálogo…" : "Nenhuma categoria com os filtros atuais. Você pode ajustar a busca."}</Text>}
        </View>
      </View>
    </Animated.View>
  );
}
