import type { ReactNode } from "react";
import { Platform, Pressable, Text, useWindowDimensions, View } from "react-native";
import Animated, { FadeIn, ReduceMotion } from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, usePathname } from "expo-router";
import Feather from "@expo/vector-icons/Feather";
import { useSession } from "../context/SessionContext";
import { Logo } from "../components/Logo";
import { fonts } from "./design";
import { HeaderTools, LoadingScreen, useAppearance } from "./Appearance";
import { Button, Page } from "./components";
const tabHighlight = FadeIn.duration(180).reduceMotion(ReduceMotion.System);

export function Shell({ children, actions }: { children: ReactNode; actions?: ReactNode }) {
  const { role, user, loading } = useSession();

  const pathname = usePathname();
  const { colors, ui } = useAppearance();
  const { width } = useWindowDimensions();
  const wide = Platform.OS === "web" && width >= 900;
  if (loading) return <LoadingScreen />;
  if (!user || !role)
    return (
      <SafeAreaView style={ui.page}>
        <Page>
          <Logo />
          <Text style={ui.title}>Entre para continuar.</Text>
          <Button title="Ir para o login" onPress={() => router.replace("/")} />
        </Page>
      </SafeAreaView>
    );
  const tabs: {
    label: string;
    href: "/" | "/orcamentos" | "/freela-plus" | "/conta" | "/historico";
    icon: keyof typeof Feather.glyphMap;
  }[] =
    role === "profissional"
      ? [
          { label: "Início", href: "/", icon: "grid" },
          { label: "Orçamentos", href: "/orcamentos", icon: "file-text" },
          { label: "Freela+", href: "/freela-plus", icon: "zap" },
          { label: "Histórico", href: "/historico", icon: "clock" },
          { label: "Conta", href: "/conta", icon: "user" },
        ]
      : [
          { label: "Explorar", href: "/", icon: "search" },
          { label: "Histórico", href: "/historico", icon: "clock" },
          { label: "Conta", href: "/conta", icon: "user" },
        ];
  const navigation = (
      <View
        style={{
          backgroundColor: colors.white,
          borderTopWidth: wide ? 0 : 1,
          borderTopColor: colors.line,
        }}
      >
        <View
          accessibilityRole="tablist"
          style={{
            flexDirection: "row",
            maxWidth: wide ? undefined : 620,
            width: wide ? undefined : "100%",
            alignSelf: "center",
            gap: wide ? 4 : 0,
          }}
        >
          {tabs.map((tab) => (
            <Pressable
              key={tab.href}
              accessibilityRole="tab"
              accessibilityLabel={tab.label}
              accessibilityState={{ selected: pathname === tab.href }}
              onPress={() => pathname !== tab.href && router.replace(tab.href)}
              style={({ pressed }) => ({
                flex: wide ? undefined : 1,
                paddingHorizontal: wide ? 12 : 0,
                flexDirection: wide ? "row" : "column",
                minWidth: 0,
                minHeight: wide ? 44 : 56,
                opacity: pressed ? 0.7 : 1,
                alignItems: "center",
                justifyContent: "center",
                gap: 3,
              })}
            >
              <View style={{ width: wide ? 26 : 40, height: 28, alignItems: "center", justifyContent: "center" }}>
                {pathname === tab.href && (
                  <Animated.View entering={tabHighlight} pointerEvents="none" style={{
                    position: "absolute", inset: 0, borderRadius: 14, backgroundColor: colors.lavender,
                  }} />
                )}
              <Feather
                name={tab.icon}
                size={wide ? 17 : 20}
                color={pathname === tab.href ? colors.purple : colors.muted}
              />
              </View>
              <Text numberOfLines={1}
                style={{
                  fontFamily:
                    pathname === tab.href ? fonts.medium : fonts.regular,
                  fontSize: wide ? 13 : 11,
                  color: colors.ink,
                }}
              >
                {tab.label}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>
  );

  return (
    <SafeAreaView style={ui.page} edges={["top", "bottom"]}>
      <View
        style={{
          backgroundColor: colors.white,
          borderBottomWidth: 1,
          borderBottomColor: colors.line,
        }}
      >
        <View
          style={[
            ui.between,
            {
              paddingHorizontal: 24,
              paddingVertical: 16,
              maxWidth: 1080,
              width: "100%",
              alignSelf: "center",
            },
          ]}
        >
          <Logo />
          {wide && navigation}
          {actions ?? <HeaderTools />}
        </View>
      </View>
      <View style={ui.fill}>{children}</View>
      {!wide && navigation}
    </SafeAreaView>
  );
}
