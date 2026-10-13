import type { ReactNode } from "react";
import { useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, usePathname } from "expo-router";
import Feather from "@expo/vector-icons/Feather";
import { useSession } from "../context/SessionContext";
import { useSubscription } from "../context/SubscriptionContext";
import { Logo } from "../components/Logo";
import { colors, fonts, ui } from "./design";
import { Button, Notice, Page } from "./components";
export function Shell({ children }: { children: ReactNode }) {
  const { role, user, loading } = useSession();
  const { usage } = useSubscription();
  const pathname = usePathname();
  if (loading)
    return (
      <SafeAreaView style={ui.page}>
        <ActivityIndicator color={colors.purple} />
      </SafeAreaView>
    );
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
    href: "/" | "/orcamentos" | "/freela-plus" | "/conta";
    icon: keyof typeof Feather.glyphMap;
  }[] =
    role === "profissional"
      ? [
          { label: "Início", href: "/", icon: "grid" },
          { label: "Orçamentos", href: "/orcamentos", icon: "file-text" },
          { label: "Freela+", href: "/freela-plus", icon: "zap" },
          { label: "Conta", href: "/conta", icon: "user" },
        ]
      : [
          { label: "Explorar", href: "/", icon: "search" },
          { label: "Conta", href: "/conta", icon: "user" },
        ];
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
          <View style={ui.badge}>
            <Text style={ui.small}>
              {role === "cliente"
                ? "Área do cliente"
                : usage?.premium
                  ? "Freela+ ativo"
                  : "Área do profissional"}
            </Text>
          </View>
        </View>
      </View>
      <View style={ui.fill}>{children}</View>
      <View
        style={{
          backgroundColor: colors.white,
          borderTopWidth: 1,
          borderTopColor: colors.line,
        }}
      >
        <View
          accessibilityRole="tablist"
          style={{
            flexDirection: "row",
            maxWidth: 620,
            width: "100%",
            alignSelf: "center",
            paddingVertical: 8,
          }}
        >
          {tabs.map((tab) => (
            <Pressable
              key={tab.href}
              accessibilityRole="tab"
              accessibilityLabel={tab.label}
              accessibilityState={{ selected: pathname === tab.href }}
              onPress={() => pathname !== tab.href && router.replace(tab.href)}
              style={{
                flex: 1,
                minHeight: 56,
                alignItems: "center",
                justifyContent: "center",
                gap: 5,
              }}
            >
              <Feather
                name={tab.icon}
                size={21}
                color={pathname === tab.href ? colors.ink : colors.muted}
              />
              <Text
                style={{
                  fontFamily:
                    pathname === tab.href ? fonts.medium : fonts.regular,
                  fontSize: 11,
                  color: colors.ink,
                }}
              >
                {tab.label}
              </Text>
              {pathname === tab.href ? (
                <View
                  style={{
                    position: "absolute",
                    top: 0,
                    width: 22,
                    height: 3,
                    backgroundColor: colors.purple,
                    borderRadius: 2,
                  }}
                />
              ) : null}
            </Pressable>
          ))}
        </View>
      </View>
    </SafeAreaView>
  );
}
export function AccountScreen() {
  const { user, role, location, logout } = useSession();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return (
    <Shell>
      <Page>
        <Text style={ui.title}>Sua conta</Text>
        <View style={[ui.card, { maxWidth: 560 }]}>
          <Text style={ui.heading}>{user?.email}</Text>
          <Text style={ui.body}>
            {role === "profissional" ? "Profissional" : "Cliente"}
          </Text>
          <View style={ui.divider} />
          <Text style={ui.body}>
            {[location.neighborhood, location.city, location.uf]
              .filter(Boolean)
              .join(", ") || "Localização não informada"}
          </Text>
          {role === "profissional" ? (
            <Button
              title="Conhecer o Freela+"
              secondary
              onPress={() => router.push("/freela-plus")}
            />
          ) : null}
          <Button
            title="Sair da conta"
            secondary
            busy={busy}
            onPress={async () => {
              setBusy(true);
              try {
                await logout();
                router.replace("/");
              } catch {
                setError("Não foi possível sair. Tente novamente.");
              } finally {
                setBusy(false);
              }
            }}
          />
          {error ? <Notice>{error}</Notice> : null}
        </View>
      </Page>
    </Shell>
  );
}
