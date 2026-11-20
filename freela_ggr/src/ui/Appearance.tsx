import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { ActivityIndicator, Linking, Pressable, Text, View } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Feather from "@expo/vector-icons/Feather";
import { darkColors, darkUi, lightColors, ui } from "./design";

const Context = createContext({ dark: false, toggle: () => {} });
const key = "freela:dark-mode";

export function Appearance({ children }: { children: ReactNode }) {
  const [dark, setDark] = useState(false);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    void AsyncStorage.getItem(key).then((value) => setDark(value === "true")).catch(() => {}).finally(() => setReady(true));
  }, []);
  function toggle() {
    setDark(!dark);
    void AsyncStorage.setItem(key, String(!dark)).catch(() => {});
  }
  return <Context.Provider value={{ dark, toggle }}>{ready ? children : <LoadingScreen />}</Context.Provider>;
}

export function useAppearance() {
  const appearance = useContext(Context);
  return { ...appearance, colors: appearance.dark ? darkColors : lightColors, ui: appearance.dark ? darkUi : ui };
}

export function HeaderTools() {
  const { dark, toggle, ui, colors } = useAppearance();
  const button = { width: 44, height: 44, alignItems: "center" as const, justifyContent: "center" as const, borderRadius: 22, backgroundColor: colors.lavender, opacity: 0.87 };
  return <View style={[ui.row, { alignSelf: "flex-end", gap: 8 }]}>
    <Pressable accessibilityRole="link" accessibilityLabel="Contatar suporte por e-mail" style={button} onPress={() => {
      void Linking.openURL("mailto:freela.support@gmail.com").catch(() => {});
    }}><Feather name="help-circle" size={18} color={colors.ink} /></Pressable>
    <Pressable accessibilityRole="switch" accessibilityLabel="Modo escuro" accessibilityState={{ checked: dark }} aria-checked={dark} style={button} onPress={toggle}>
      <Feather name={dark ? "moon" : "sun"} size={18} color={colors.ink} />
    </Pressable>
  </View>;
}

export function LoadingScreen() {
  const { colors, ui } = useAppearance();
  return <View style={[ui.page, { justifyContent: "center", alignItems: "center", gap: 16 }]} accessibilityState={{ busy: true }}>
    <View style={{ backgroundColor: colors.green, borderRadius: 22, paddingHorizontal: 26, paddingVertical: 12 }}>
      <Text style={{ fontSize: 32, fontWeight: "800", color: "#1F1633" }}>Freela</Text>
    </View>
    <ActivityIndicator color={colors.purple} />
    <Text accessibilityLiveRegion="polite" style={{ color: colors.muted, fontSize: 15 }}>Carregando…</Text>
  </View>;
}
