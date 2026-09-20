import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import Feather from "@expo/vector-icons/Feather";

import { BRAZIL_STATES, fetchCitiesByUf } from "../data/brazil";
import {
  buscarCep,
  formatCep,
  searchNeighborhoods,
  stateNameFromUf,
} from "../data/viacep";
import { emptyLocation, type LocationValue } from "../types/app";
import { normalize } from "../utils/searchTools";
import { locationStyles as styles } from "./LocationFields.styles";

export type { LocationValue };
export { emptyLocation };

export function LocationFields({
  value,
  onChange,
  compact = false,
  showStreet = false,
}: {
  value: LocationValue;
  onChange: (next: LocationValue) => void;
  compact?: boolean;
  showStreet?: boolean;
}) {
  const [open, setOpen] = useState<"state" | "city" | "neighborhood" | null>(null);
  const [search, setSearch] = useState("");
  const [cities, setCities] = useState<string[]>([]);
  const [neighborhoods, setNeighborhoods] = useState<string[]>([]);
  const [loadingCities, setLoadingCities] = useState(false);
  const [loadingNeighborhoods, setLoadingNeighborhoods] = useState(false);
  const [buscandoCep, setBuscandoCep] = useState(false);

  useEffect(() => {
    if (!value.uf) {
      setCities([]);
      return;
    }
    let cancelled = false;
    setLoadingCities(true);
    fetchCitiesByUf(value.uf)
      .then((list) => {
        if (!cancelled) setCities(list);
      })
      .finally(() => {
        if (!cancelled) setLoadingCities(false);
      });
    return () => {
      cancelled = true;
    };
  }, [value.uf]);

  useEffect(() => {
    if (!value.uf || !value.city || search.length < 2 || open !== "neighborhood") {
      return;
    }
    let cancelled = false;
    setLoadingNeighborhoods(true);
    searchNeighborhoods(value.uf, value.city, search)
      .then((list) => {
        if (!cancelled) setNeighborhoods(list);
      })
      .finally(() => {
        if (!cancelled) setLoadingNeighborhoods(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, search, value.city, value.uf]);

  async function handleCepChange(cepDigitado: string) {
    const formatted = formatCep(cepDigitado);
    onChange({ ...value, cep: formatted });
    const cepLimpo = cepDigitado.replace(/\D/g, "");
    if (cepLimpo.length !== 8) return;

    setBuscandoCep(true);
    try {
      const endereco = await buscarCep(cepDigitado);
      if (!endereco) return;
      onChange({
        cep: formatted,
        street: endereco.rua,
        neighborhood: endereco.bairro,
        city: endereco.cidade,
        uf: endereco.estado,
        stateName: stateNameFromUf(endereco.estado),
      });
    } catch (error) {
      Alert.alert(
        "Erro",
        error instanceof Error && error.message === "CEP_NOT_FOUND"
          ? "CEP não encontrado."
          : "Não foi possível buscar o CEP.",
      );
    } finally {
      setBuscandoCep(false);
    }
  }

  const options = useMemo(() => {
    const term = normalize(search);
    if (open === "state") {
      return BRAZIL_STATES.filter((state) =>
        normalize(`${state.nome} ${state.uf}`).includes(term),
      ).map((state) => ({
        key: state.uf,
        label: `${state.nome} (${state.uf})`,
      }));
    }
    if (open === "city") {
      return cities
        .filter((city) => normalize(city).includes(term))
        .map((city) => ({ key: city, label: city }));
    }
    const extra = value.neighborhood ? [value.neighborhood] : [];
    return [...new Set([...neighborhoods, ...extra])]
      .filter((item) => normalize(item).includes(term))
      .map((item) => ({ key: item, label: item }));
  }, [cities, neighborhoods, open, search, value.neighborhood]);

  function selectState(uf: string) {
    const state = BRAZIL_STATES.find((item) => item.uf === uf);
    if (!state) return;
    onChange({
      ...value,
      uf: state.uf,
      stateName: state.nome,
      city: "",
      neighborhood: "",
      street: "",
    });
    setOpen(null);
    setSearch("");
  }

  function selectCity(city: string) {
    onChange({ ...value, city, neighborhood: "", street: "" });
    setOpen(null);
    setSearch("");
    setNeighborhoods([]);
  }

  function selectNeighborhood(neighborhood: string) {
    onChange({ ...value, neighborhood });
    setOpen(null);
    setSearch("");
  }

  const sheetTitle =
    open === "state"
      ? "Escolha o estado"
      : open === "city"
        ? "Escolha a cidade"
        : "Escolha o bairro";

  return (
    <View style={compact ? styles.compactStack : styles.stack}>
      <TextInput
        value={value.cep}
        onChangeText={handleCepChange}
        placeholder="CEP"
        placeholderTextColor="#71717A"
        keyboardType="numeric"
        maxLength={9}
        style={[styles.field, styles.cepInput, compact && styles.fieldCompact]}
      />
      {buscandoCep ? <Text style={styles.loadingText}>Buscando endereço...</Text> : null}

      <View style={compact ? styles.compactRow : styles.stack}>
        <Pressable
          style={[styles.field, compact && styles.fieldCompact]}
          onPress={() => {
            setSearch("");
            setOpen("state");
          }}
        >
          <Feather name="map-pin" size={16} color="#A1A1AA" />
          <Text style={[styles.fieldText, !value.uf && styles.placeholder]} numberOfLines={1}>
            {value.uf ? `${value.stateName} (${value.uf})` : "Estado"}
          </Text>
          <Feather name="chevron-down" size={16} color="#71717A" />
        </Pressable>
        <Pressable
          style={[styles.field, compact && styles.fieldCompact, !value.uf && styles.fieldDisabled]}
          disabled={!value.uf}
          onPress={() => {
            setSearch("");
            setOpen("city");
          }}
        >
          <Feather name="navigation" size={16} color="#A1A1AA" />
          <Text style={[styles.fieldText, !value.city && styles.placeholder]} numberOfLines={1}>
            {value.city || "Cidade"}
          </Text>
          <Feather name="chevron-down" size={16} color="#71717A" />
        </Pressable>
      </View>

      <Pressable
        style={[styles.field, compact && styles.fieldCompact, !value.city && styles.fieldDisabled]}
        disabled={!value.city}
        onPress={() => {
          setSearch("");
          setNeighborhoods(value.neighborhood ? [value.neighborhood] : []);
          setOpen("neighborhood");
        }}
      >
        <Feather name="home" size={16} color="#A1A1AA" />
        <Text
          style={[styles.fieldText, !value.neighborhood && styles.placeholder]}
          numberOfLines={1}
        >
          {value.neighborhood || "Bairro"}
        </Text>
        <Feather name="chevron-down" size={16} color="#71717A" />
      </Pressable>

      {showStreet ? (
        <TextInput
          value={value.street}
          onChangeText={(street) => onChange({ ...value, street })}
          placeholder="Rua"
          placeholderTextColor="#71717A"
          style={[styles.field, styles.cepInput]}
        />
      ) : null}

      <Modal
        visible={open !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setOpen(null)}
      >
        <Pressable style={styles.backdrop} onPress={() => setOpen(null)}>
          <Pressable style={styles.sheet} onPress={() => {}}>
            <Text style={styles.sheetTitle}>{sheetTitle}</Text>
            <View style={styles.searchBox}>
              <Feather name="search" size={16} color="#71717A" />
              <TextInput
                value={search}
                onChangeText={setSearch}
                placeholder={
                  open === "neighborhood"
                    ? "Digite o bairro para buscar no ViaCEP"
                    : "Pesquisar"
                }
                placeholderTextColor="#71717A"
                style={styles.searchInput}
                autoFocus
              />
            </View>
            {(open === "city" && loadingCities) ||
            (open === "neighborhood" && loadingNeighborhoods) ? (
              <ActivityIndicator color="#CCFF00" style={{ marginTop: 24 }} />
            ) : (
              <ScrollView style={styles.list} keyboardShouldPersistTaps="handled">
                {open === "neighborhood" && search.trim().length >= 2 && !options.length ? (
                  <Pressable
                    style={styles.option}
                    onPress={() => selectNeighborhood(search.trim())}
                  >
                    <Text style={styles.optionText}>Usar “{search.trim()}”</Text>
                  </Pressable>
                ) : null}
                {options.map((option) => (
                  <Pressable
                    key={option.key}
                    style={styles.option}
                    onPress={() => {
                      if (open === "state") selectState(option.key);
                      else if (open === "city") selectCity(option.key);
                      else selectNeighborhood(option.key);
                    }}
                  >
                    <Text style={styles.optionText}>{option.label}</Text>
                  </Pressable>
                ))}
                {!options.length && open !== "neighborhood" ? (
                  <Text style={styles.empty}>Nenhum resultado encontrado.</Text>
                ) : null}
                {open === "neighborhood" && search.length < 2 ? (
                  <Text style={styles.empty}>
                    Digite pelo menos 2 letras para localizar o bairro.
                  </Text>
                ) : null}
              </ScrollView>
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}
