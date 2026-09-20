import * as ImagePicker from "expo-image-picker";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Image,
  Modal,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import Feather from "@expo/vector-icons/Feather";

import { LocationFields } from "../components/LocationFields";
import { Logo } from "../components/Logo";
import { ReportServiceButton } from "../components/ReportServiceButton";
import { ServiceRating } from "../components/ServiceRating";
import { useSession } from "../context/SessionContext";
import { buildCatalogDictionary, serviceCategories } from "../data/catalog";
import { createBudget, listCompletedJobs, listServices, updateJobRating } from "../data/remote";
import type { CompletedJob, Service } from "../types/app";
import { distance, normalize } from "../utils/searchTools";
import { styles } from "./HomeScreen.styles";

function findSuggestion(query: string, catalogDictionary: string[]) {
  const term = normalize(query);
  if (
    term.length < 3 ||
    catalogDictionary.some((word) => word === term || word.includes(term))
  ) {
    return null;
  }
  const suggestion = catalogDictionary.reduce<{ word: string; score: number } | null>(
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

export function ClientHomeScreen() {
  const { location, setLocation, logout } = useSession();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("Todos");
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [attachmentUri, setAttachmentUri] = useState<string | null>(null);
  const [requestDetails, setRequestDetails] = useState("");
  const [sendingRequest, setSendingRequest] = useState(false);
  const [catalogServices, setCatalogServices] = useState<Service[]>([]);
  const [completedJobs, setCompletedJobs] = useState<CompletedJob[]>([]);
  const catalogDictionary = useMemo(
    () => buildCatalogDictionary(catalogServices),
    [catalogServices],
  );
  const suggestion = useMemo(
    () => findSuggestion(query, catalogDictionary),
    [catalogDictionary, query],
  );

  useEffect(() => {
    let active = true;
    Promise.all([listServices(), listCompletedJobs()]).then(([services, jobs]) => {
      if (!active) return;
      setCatalogServices(services);
      setCompletedJobs(jobs);
    });
    return () => {
      active = false;
    };
  }, []);

  const filteredServices = useMemo(() => {
    const normalizedQuery = normalize(query);
    const searchTerm =
      suggestion && normalizedQuery.length > 0 ? suggestion : normalizedQuery;
    return catalogServices.filter((service) => {
      const matchesCategory = category === "Todos" || service.category === category;
      const matchesState = !location.uf || service.uf === location.uf;
      const matchesCity = !location.city || service.city === location.city;
      const matchesNeighborhood =
        !location.neighborhood ||
        normalize(service.neighborhood) === normalize(location.neighborhood);
      const searchable = normalize(
        `${service.title} ${service.category} ${service.provider} ${service.description} ${service.neighborhood}`,
      );
      return (
        matchesCategory &&
        matchesState &&
        matchesCity &&
        matchesNeighborhood &&
        (!searchTerm || searchable.includes(searchTerm))
      );
    });
  }, [category, location.city, location.neighborhood, location.uf, query, suggestion]);

  const locatedServices = catalogServices.filter(
    (service) =>
      (!location.uf || service.uf === location.uf) &&
      (!location.city || service.city === location.city) &&
      (!location.neighborhood ||
        normalize(service.neighborhood) === normalize(location.neighborhood)),
  );
  const trending = locatedServices.filter((service) => service.trending);
  const recent = locatedServices.filter((service) => service.recent);

  function openService(service: Service) {
    setAttachmentUri(null);
    setRequestDetails("");
    setSelectedService(service);
  }

  async function sendServiceRequest() {
    if (!selectedService) return;

    setSendingRequest(true);
    await createBudget({
      client: "Cliente do app",
      service: selectedService.title,
      value: selectedService.price,
      status: "solicitado",
    });
    setSendingRequest(false);
    setAttachmentUri(null);
    setRequestDetails("");
    setSelectedService(null);
    Alert.alert("Solicitação enviada", "O pedido foi salvo no Supabase e enviado ao profissional.");
  }

  async function attachImage() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert("Permissão necessária", "Permita o acesso às fotos para anexar uma imagem.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      quality: 0.8,
    });
    if (!result.canceled) setAttachmentUri(result.assets[0].uri);
  }

  async function rateJob(id: string, rating: number) {
    setCompletedJobs((current) =>
      current.map((job) => (job.id === id ? { ...job, rating } : job)),
    );
    await updateJobRating(id, rating);
  }

  const locationLabel = location.neighborhood
    ? `${location.neighborhood}, ${location.city} - ${location.uf}`
    : location.city
      ? `${location.city}, ${location.uf}`
      : location.uf
        ? location.stateName
        : "";

  return (
    <View style={styles.page}>
      <View style={styles.header}>
        <Logo />
        <View style={styles.headerActions}>
          <Text style={styles.headerRole}>CLIENTE</Text>
          <Pressable style={styles.logoutButton} hitSlop={12} onPress={logout}>
            <Feather name="log-out" size={15} color="#71717A" />
            <Text style={styles.logout}>Sair</Text>
          </Pressable>
        </View>
      </View>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.overline}>CATÁLOGO DE SERVIÇOS</Text>
        <Text style={styles.pageTitle}>O que você precisa resolver?</Text>
        <Text style={styles.pageSubtitle}>
          Pesquise um serviço ou explore as opções mais procuradas.
        </Text>
        <LocationFields compact value={location} onChange={setLocation} />
        <Text style={styles.locationHint}>
          {locationLabel
            ? `Mostrando serviços em ${locationLabel}`
            : "Informe o CEP ou escolha estado, cidade e bairro."}
        </Text>
        <View style={styles.searchBox}>
          <Feather name="search" size={19} color="#18181B" style={styles.searchIcon} />
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
          <Pressable style={styles.suggestion} onPress={() => setQuery(suggestion)}>
            <Text style={styles.suggestionText}>
              Você quis dizer <Text style={styles.suggestionStrong}>{suggestion}</Text>?
            </Text>
            <Text style={styles.suggestionAction}>Usar termo</Text>
          </Pressable>
        ) : null}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.categoryRow}
        >
          {serviceCategories.map((item) => (
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
            <ServiceRail title="Em alta agora" items={trending} onSelect={openService} />
            <ServiceList title="Adicionados recentemente" items={recent} onSelect={openService} />
          </>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Serviços concluídos</Text>
          {completedJobs.length ? (
            completedJobs.map((job) => (
              <CompletedJobCard key={job.id} job={job} onRate={rateJob} />
            ))
          ) : (
            <View style={styles.empty}>
              <Text style={styles.emptyTitle}>Nenhum serviço concluído</Text>
              <Text style={styles.emptyText}>
                Quando um pedido for concluído, a avaliação aparecerá aqui.
              </Text>
            </View>
          )}
        </View>
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
              {selectedService?.provider} · a partir de {selectedService?.price}
            </Text>
            <TextInput
              value={requestDetails}
              onChangeText={setRequestDetails}
              multiline
              placeholder="Conte um pouco sobre o que você precisa"
              placeholderTextColor="#71717A"
              style={[styles.input, styles.messageInput]}
            />
            <Pressable style={styles.attachButton} onPress={attachImage}>
              <Feather name="paperclip" size={17} color="#18181B" />
              <Text style={styles.attachText}>
                {attachmentUri ? "Imagem anexada" : "Anexar imagem"}
              </Text>
            </Pressable>
            {attachmentUri ? (
              <Image source={{ uri: attachmentUri }} style={styles.attachmentPreview} />
            ) : null}
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
                disabled={sendingRequest}
                onPress={sendServiceRequest}
              >
                <Text style={styles.primaryButtonText}>
                  {sendingRequest ? "Enviando..." : "Enviar pedido"}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function CompletedJobCard({
  job,
  onRate,
}: {
  job: CompletedJob;
  onRate: (id: string, rating: number) => void;
}) {
  return (
    <View style={styles.completedCard}>
      <View style={styles.cardTop}>
        <View>
          <Text style={styles.serviceTitle}>{job.title}</Text>
          <Text style={styles.provider}>{job.provider}</Text>
          <Text style={styles.budgetDate}>{job.date}</Text>
        </View>
        <ReportServiceButton serviceTitle={job.title} />
      </View>
      <ServiceRating value={job.rating} onChange={(rating) => onRate(job.id, rating)} />
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
          <Text style={styles.emptyText}>Tente uma categoria, bairro ou termo mais amplo.</Text>
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
            <Text style={styles.railProvider}>
              {service.provider} · {service.neighborhood}
            </Text>
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
        <View style={styles.cardActions}>
          <Text style={styles.rating}>Nota {service.rating}</Text>
          <ReportServiceButton serviceTitle={service.title} />
        </View>
      </View>
      <Text style={styles.serviceTitle}>{service.title}</Text>
      <Text style={styles.provider}>{service.provider}</Text>
      <Text style={styles.description}>{service.description}</Text>
      <Text style={styles.locationHint}>
        {service.neighborhood}, {service.city} - {service.uf}
      </Text>
      <View style={styles.serviceBottom}>
        <Text style={styles.price}>A partir de {service.price}</Text>
        <Text style={styles.link}>Ver serviço →</Text>
      </View>
    </Pressable>
  );
}
