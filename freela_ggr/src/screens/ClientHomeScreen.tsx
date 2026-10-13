import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import Feather from "@expo/vector-icons/Feather";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LocationFields } from "../components/LocationFields";
import { useSession } from "../context/SessionContext";
import {
  listBudgets,
  updateBudgetStatus,
  listServices,
  listCompletedJobs,
  createBudget,
  updateJobRating,
} from "../data/remote";
import { buildCatalogDictionary, serviceCategories } from "../data/catalog";
import { distance, normalize } from "../utils/searchTools";
import type { Budget, BudgetStatus, Service, CompletedJob } from "../types/app";
import { Button, Empty, Field, Notice, Page } from "../ui/components";
import { colors, fonts, ui } from "../ui/design";

export function ClientHomeScreen() {
  const { location, setLocation } = useSession();
  const insets = useSafeAreaInsets();
  const [services, setServices] = useState<Service[]>([]);
  const [jobs, setJobs] = useState<CompletedJob[]>([]);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [responding, setResponding] = useState<string | null>(null);
  const responseLock = useRef(false);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("Todos");
  const [editLocation, setEditLocation] = useState(false);
  const [selected, setSelected] = useState<Service | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [modalError, setModalError] = useState("");
  const [success, setSuccess] = useState("");
  const [ratingId, setRatingId] = useState<string | null>(null);
  const lock = useRef(false);
  const ratingLock = useRef(false);
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
      const [s, j, b] = await Promise.all([listServices(), listCompletedJobs(), listBudgets()]);
      setBudgets(b);
      setServices(s);
      setJobs(j);
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
  async function send() {
    if (lock.current || !selected) return;
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
      });
      setBudgets((old) => [request, ...old]);
      setDrafts((old) => ({ ...old, [selected.id]: "" }));
      setSelected(null);
      setSuccess(
        "Pedido enviado. O profissional já pode consultar sua solicitação.",
      );
    } catch {
      setModalError(
        "Não foi possível enviar. Seus detalhes foram mantidos. Tente novamente.",
      );
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  async function respond(id: string, status: BudgetStatus) {
    if (responseLock.current) return;
    responseLock.current = true;
    setResponding(id);
    try {
      await updateBudgetStatus(id, status);
      setBudgets(old => old.map(b => b.id === id ? { ...b, status } : b));
    } catch {
      setError("Não foi possível atualizar o pedido. Tente novamente.");
    } finally {
      responseLock.current = false;
      setResponding(null);
    }
  }
  const statuses: Record<BudgetStatus, string> = { solicitado: "Pedido enviado", cotado: "Proposta recebida", aceito: "Aceito", em_andamento: "Em andamento", realizado: "Concluído", recusado: "Recusado", cancelado: "Cancelado" };
  async function rate(id: string, rating: number) {
    if (ratingLock.current) return;
    ratingLock.current = true;
    setRatingId(id);
    try {
      await updateJobRating(id, rating);
      setJobs((old) => old.map((j) => (j.id === id ? { ...j, rating } : j)));
    } catch {
      setError("Não foi possível salvar sua avaliação. Tente novamente.");
    } finally {
      ratingLock.current = false;
      setRatingId(null);
    }
  }
  const filtered = services.filter(
    (s) =>
      (category === "Todos" || s.category === category) &&
      (!location.uf || s.uf === location.uf) &&
      (!location.city || s.city === location.city) &&
      (!location.neighborhood ||
        normalize(s.neighborhood) === normalize(location.neighborhood)) &&
      (!query ||
        normalize(
          s.title + " " + s.category + " " + s.provider + " " + s.description,
        ).includes(suggestion ?? normalize(query))),
  );
  return (
    <>
      <Page>
        {budgets.length > 0 ? <View style={{ gap: 16 }}>
          <Text style={ui.heading}>Seus pedidos</Text>
          {budgets.map(b => <View key={b.id} style={ui.card}>
            <Text style={ui.heading}>{b.service}</Text>
            <Text style={ui.label}>{statuses[b.status]}</Text>
            {b.details ? <Text style={ui.body}>{b.details}</Text> : null}
            {b.quoteAmount != null ? <Text style={ui.heading}>{b.value}</Text> : null}
            {b.quoteMessage ? <Text style={ui.body}>{b.quoteMessage}</Text> : null}
            {b.status === "cotado" ? <>
              <Button title="Aceitar proposta" busy={responding === b.id} disabled={!!responding} onPress={() => void respond(b.id, "aceito")} />
              <Button title="Recusar proposta" secondary disabled={!!responding} onPress={() => void respond(b.id, "recusado")} />
            </> : null}
            {["solicitado", "cotado", "aceito"].includes(b.status) ? <Button title="Cancelar pedido" secondary disabled={!!responding} onPress={() => void respond(b.id, "cancelado")} /> : null}
          </View>)}
        </View> : null}
        <View style={[ui.hero, { backgroundColor: colors.lavender }]}>
          <Text style={[ui.heroTitle, { color: colors.ink }]}>
            Tem algo para fazer?{"\n"}Encontre quem resolve.
          </Text>
          <Text style={ui.body}>
            Profissionais e serviços para os planos do seu dia.
          </Text>
          <Field
            label="Qual serviço você procura?"
            value={query}
            onChangeText={setQuery}
            placeholder="Pintura, elétrica, limpeza…"
          />
          {suggestion ? (
            <Button
              title={`Buscar por “${suggestion}”`}
              secondary
              onPress={() => setQuery(suggestion)}
            />
          ) : null}
        </View>
        <Pressable
          accessibilityRole="button"
          onPress={() => setEditLocation(!editLocation)}
          style={ui.between}
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
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 8 }}
        >
          {serviceCategories.map((item) => (
            <Pressable
              key={item}
              accessibilityRole="button"
              onPress={() => setCategory(item)}
              style={[ui.chip, category === item && ui.chipActive]}
            >
              <Text
                style={[ui.label, category === item && { color: colors.white }]}
              >
                {item}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
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
          <Text style={ui.small}>{filtered.length} opções</Text>
        </View>
        {loading ? (
          <ActivityIndicator color={colors.purple} />
        ) : !filtered.length ? (
          <Empty
            title="Vamos ampliar a busca?"
            text="Tente outro serviço ou ajuste sua região para encontrar mais opções."
            icon="search"
          />
        ) : (
          <View style={{ gap: 14 }}>
            {filtered.map((service, index) => (
              <Pressable
                key={service.id}
                accessibilityRole="button"
                onPress={() => {
                  setSelected(service);
                  setModalError("");
                }}
                style={({ pressed }) => [
                  ui.card,
                  { opacity: pressed ? 0.8 : 1 },
                ]}
              >
                <View style={ui.row}>
                  <View
                    style={{
                      backgroundColor: index % 2 ? colors.lavender : "#E2F6D5",
                      width: 50,
                      height: 50,
                      borderRadius: 14,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Feather name="tool" size={23} color={colors.ink} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={ui.heading}>{service.title}</Text>
                    <Text style={ui.small}>{service.provider}</Text>
                  </View>
                </View>
                <Text style={ui.body}>{service.description}</Text>
                <View style={ui.divider} />
                <View style={ui.between}>
                  <View>
                    <Text style={ui.small}>A partir de</Text>
                    <Text style={[ui.heading, { color: colors.success }]}>
                      {service.price}
                    </Text>
                  </View>
                  <View style={ui.row}>
                    <Text style={ui.label}>Ver serviço</Text>
                    <Feather
                      name="arrow-up-right"
                      size={20}
                      color={colors.ink}
                    />
                  </View>
                </View>
              </Pressable>
            ))}
          </View>
        )}
        <Text style={ui.heading}>Seu trabalho concluído</Text>
        {!jobs.length ? (
          <Empty
            title="Tudo começa com um pedido"
            text="Depois de concluir um serviço, deixe sua avaliação por aqui."
            icon="check-circle"
          />
        ) : (
          jobs.map((job) => (
            <View key={job.id} style={ui.card}>
              <Text style={ui.heading}>{job.title}</Text>
              <Text style={ui.body}>{job.provider}</Text>
              <View style={ui.row}>
                {[1, 2, 3, 4, 5].map((star) => (
                  <Pressable
                    key={star}
                    accessibilityRole="button"
                    accessibilityLabel={"Avaliar com " + star + " estrelas"}
                    disabled={!!ratingId}
                    onPress={() => void rate(job.id, star)}
                    style={{
                      minWidth: 44,
                      minHeight: 48,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Feather
                      name="star"
                      size={25}
                      color={
                        star <= (job.rating ?? 0) ? colors.purple : "#A7A1B0"
                      }
                    />
                  </Pressable>
                ))}
              </View>
            </View>
          ))
        )}
      </Page>
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
                <Text style={ui.small}>Solicitar um orçamento</Text>
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
              <Text style={ui.body}>{selected?.provider}</Text>
              <Text style={ui.heading}>A partir de {selected?.price}</Text>
              <Text style={ui.body}>{selected?.description}</Text>
              <Field
                label="O que você precisa? (opcional)"
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
              {modalError ? <Notice>{modalError}</Notice> : null}
              <Button
                title="Enviar pedido"
                busy={busy}
                onPress={() => void send()}
              />
              <Text style={ui.small}>
                O valor final será combinado com o profissional. Fechar esta
                janela mantém seu texto nesta sessão.
              </Text>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
}
