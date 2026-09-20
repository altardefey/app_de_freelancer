import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import Feather from "@expo/vector-icons/Feather";

import { BRAZIL_STATES, fetchCitiesByUf } from "../data/brazil";
import { normalize } from "../utils/searchTools";
import { locationStyles as styles } from "./LocationFields.styles";

export type LocationValue = {
  uf: string;
  stateName: string;
  city: string;
};

export function LocationFields({
  value,
  onChange,
  compact = false,
}: {
  value: LocationValue;
  onChange: (next: LocationValue) => void;
  compact?: boolean;
}) {
  const [open, setOpen] = useState<"state" | "city" | null>(null);
  const [search, setSearch] = useState("");
  const [cities, setCities] = useState<string[]>([]);
  const [loadingCities, setLoadingCities] = useState(false);

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
    return cities
      .filter((city) => normalize(city).includes(term))
      .map((city) => ({ key: city, label: city }));
  }, [cities, open, search]);

  function selectState(uf: string) {
    const state = BRAZIL_STATES.find((item) => item.uf === uf);
    if (!state) return;
    onChange({ uf: state.uf, stateName: state.nome, city: "" });
    setOpen(null);
    setSearch("");
  }

  function selectCity(city: string) {
    onChange({ ...value, city });
    setOpen(null);
    setSearch("");
  }

  return (
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

      <Modal
        visible={open !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setOpen(null)}
      >
        <Pressable style={styles.backdrop} onPress={() => setOpen(null)}>
          <Pressable style={styles.sheet} onPress={() => {}}>
            <Text style={styles.sheetTitle}>
              {open === "state" ? "Escolha o estado" : "Escolha a cidade"}
            </Text>
            <View style={styles.searchBox}>
              <Feather name="search" size={16} color="#71717A" />
              <TextInput
                value={search}
                onChangeText={setSearch}
                placeholder="Pesquisar"
                placeholderTextColor="#71717A"
                style={styles.searchInput}
                autoFocus
              />
            </View>
            {open === "city" && loadingCities ? (
              <ActivityIndicator color="#CCFF00" style={{ marginTop: 24 }} />
            ) : (
              <ScrollView style={styles.list} keyboardShouldPersistTaps="handled">
                {options.map((option) => (
                  <Pressable
                    key={option.key}
                    style={styles.option}
                    onPress={() =>
                      open === "state" ? selectState(option.key) : selectCity(option.key)
                    }
                  >
                    <Text style={styles.optionText}>{option.label}</Text>
                  </Pressable>
                ))}
                {!options.length ? (
                  <Text style={styles.empty}>Nenhum resultado encontrado.</Text>
                ) : null}
              </ScrollView>
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}
