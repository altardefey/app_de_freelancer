import { useEffect, useState, type ReactNode } from "react";
import { Modal, Platform, Pressable, ScrollView, Text, View } from "react-native";
import Feather from "@expo/vector-icons/Feather";
import Animated, { ReduceMotion, useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";
import { useSession } from "../context/SessionContext";
import { LEGAL_VERSION, legalDocuments } from "../data/legalDocuments";
import { supabase } from "../lib/supabase";
import { webApi } from "../lib/webApi";
import { HeaderTools, LoadingScreen, useAppearance } from "../ui/Appearance";
import { Button, Notice, Page } from "../ui/components";

type Document = keyof typeof legalDocuments;
const topics: Record<Document, readonly string[]> = {
  terms: ["Como o Freela funciona", "Pagamentos e Freela+", "Conversas fora do app", "Cadastro e anúncios", "Denúncias e suporte", "Mudanças nos termos"],
  privacy: ["Contato de privacidade", "Dados do cadastro", "Catálogo e pedidos", "Serviços que usamos", "Por que tratamos os dados", "Compartilhamento pelo WhatsApp", "Seus direitos", "Retenção e encerramento"],
};

type Status = { version: string; accepted: boolean };

export function LegalConsent({ terms, privacy, setTerms, setPrivacy }: {
  terms?: boolean; privacy?: boolean; setTerms?: (value: boolean) => void; setPrivacy?: (value: boolean) => void;
}) {
  const { colors, ui } = useAppearance();
  const [document, setDocument] = useState<Document | null>(null);
  const [openTopic, setOpenTopic] = useState<number | null>(0);
  const reduceMotion = useReducedMotion();
  return <View style={{ gap: 12 }}>
    {([
      ["terms", terms, setTerms, "Aceito os Termos de Uso"],
      ["privacy", privacy, setPrivacy, "Li a Política de Privacidade"],
    ] as const).map(([key, checked, setChecked, label]) => <View key={key}>
      {setChecked && <Pressable accessibilityRole="checkbox" accessibilityState={{ checked }} aria-checked={checked} onPress={() => setChecked(!checked)} style={[ui.row, { minHeight: 48 }]}>
        <Text style={ui.heading}>{checked ? "☑" : "☐"}</Text><Text style={ui.label}>{label}</Text>
      </Pressable>}
      <Pressable accessibilityRole="link" onPress={() => { setOpenTopic(0); setDocument(key); }} style={{ minHeight: 44, justifyContent: "center" }}>
        <Text style={[ui.label, { color: colors.purple, textDecorationLine: "underline" }]}>Ler {legalDocuments[key].title}</Text>
      </Pressable>
    </View>)}
    <Modal visible={document !== null} onRequestClose={() => setDocument(null)} animationType={reduceMotion ? "none" : "slide"}>
      <SafeAreaView style={ui.page}>
        <ScrollView contentContainerStyle={ui.content}>
          <Text style={ui.title}>{document && legalDocuments[document].title}</Text>
          <Text style={ui.small}>Versão {LEGAL_VERSION}</Text>
          {document && <View style={{ gap: 8 }}>
            {legalDocuments[document].paragraphs.map((paragraph, index) => {
              const expanded = openTopic === index;
              return <LegalTopic key={paragraph} expanded={expanded}
                title={topics[document][index] ?? "Seção " + (index + 1)}
                onToggle={() => setOpenTopic(expanded ? null : index)}>
                {paragraph}
              </LegalTopic>;
            })}
          </View>}
          <Button title="Fechar" onPress={() => setDocument(null)} />
        </ScrollView>
      </SafeAreaView>
    </Modal>
  </View>;
}

function LegalTopic({ title, expanded, onToggle, children }: {
  title: string; expanded: boolean; onToggle: () => void; children: string;
}) {
  const { colors, ui } = useAppearance();
  const measuredHeight = useSharedValue(0);
  const animatedStyle = useAnimatedStyle(() => ({
    height: withTiming(expanded ? measuredHeight.value : 0, {
      duration: 220,
      reduceMotion: ReduceMotion.System,
    }),
  }));

  return (
    <View style={[ui.card, { padding: 0, gap: 0, overflow: "hidden" }]}>
      <Pressable accessibilityRole="button" accessibilityState={{ expanded }} onPress={onToggle}
        style={[ui.row, { minHeight: 48, paddingHorizontal: 16, paddingVertical: 10 }]}>
        <Text style={[ui.label, { flex: 1 }]}>{title}</Text>
        <Feather name={expanded ? "minus" : "plus"} size={19} color={colors.purple} />
      </Pressable>
      <Animated.View aria-hidden={!expanded} accessibilityElementsHidden={!expanded}
        importantForAccessibility={expanded ? "auto" : "no-hide-descendants"}
        style={[{ overflow: "hidden" }, animatedStyle]}>
        <View onLayout={({ nativeEvent }) => { measuredHeight.value = nativeEvent.layout.height; }}
          style={{ position: "absolute", top: 0, left: 0, right: 0, paddingHorizontal: 16, paddingBottom: 16 }}>
          <Text style={ui.body}>{children}</Text>
        </View>
      </Animated.View>
    </View>
  );
}

async function status() {
  const result = Platform.OS === "web"
    ? await webApi<Status>("legalStatus")
    : await supabase.rpc("legal_status").then(({ data, error }) => {
        if (error) throw error;
        return data as Status;
      });
  if (!result || typeof result.version !== "string" || typeof result.accepted !== "boolean") throw new Error();
  return result;
}

export function LegalGate({ children }: { children: ReactNode }) {
  const { user, role, logout, loading } = useSession();
  return <>{children}{user && role && !loading ? <Review key={user.id} logout={logout} /> : null}</>;
}

function Review({ logout }: { logout: () => Promise<void> }) {
  const { ui } = useAppearance();
  const [result, setResult] = useState<Status>();
  const [terms, setTerms] = useState(false);
  const [privacy, setPrivacy] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    void status().then((value) => { if (active) setResult(value); }).catch(() => {
      if (active) setError("Não foi possível consultar os documentos. Tente novamente.");
    });
    return () => { active = false; };
  }, [attempt]);
  if (result?.accepted) return null;
  const outdated = result && result.version !== LEGAL_VERSION;
  async function accept() {
    if (busy || !terms || !privacy || outdated || !result) return;
    setBusy(true);
    setError("");
    try {
      if (Platform.OS === "web") await webApi("acceptLegal", { version: LEGAL_VERSION });
      else {
        const { error } = await supabase.rpc("accept_legal", { document_version: LEGAL_VERSION });
        if (error) throw error;
      }
      setResult(await status());
    } catch {
      setError("Não foi possível registrar o aceite. Tente novamente.");
    } finally {
      setBusy(false);
    }
  }
  return <Modal visible onRequestClose={() => {}}>
    <SafeAreaView style={ui.page}>
      <HeaderTools />
      {!result && !error ? <LoadingScreen /> : <Page>
        <Text style={ui.title}>Revise os documentos do Freela</Text>
        {outdated ? <Notice>Atualize o app para ler a versão vigente.</Notice> : result ?
          <><Text style={ui.body}>Leia os documentos e marque as duas caixas para continuar.</Text><LegalConsent {...{ terms, privacy, setTerms, setPrivacy }} /><Button title="Aceitar e continuar" disabled={!terms || !privacy} busy={busy} onPress={() => void accept()} /></> :
          <Button title="Tentar novamente" onPress={() => { setError(""); setAttempt((n) => n + 1); }} />}
        {error ? <Notice>{error}</Notice> : null}
        <Button title="Sair da conta" secondary onPress={() => void logout().catch(() => setError("Não foi possível sair da conta."))} />
      </Page>}
    </SafeAreaView>
  </Modal>;
}
