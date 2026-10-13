import { useEffect, useRef, useState } from "react";
import {
  Linking,
  Pressable,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import Feather from "@expo/vector-icons/Feather";
import { router } from "expo-router";
import type { PurchasesPackage } from "react-native-purchases";
import { useSession } from "../context/SessionContext";
import { useSubscription } from "../context/SubscriptionContext";
import { getUsage } from "../data/quotes";
import {
  billing,
  billingAvailable,
  isTestStore,
  monthlyPackage,
  presentFreelaPaywall,
  REVENUECAT_ENTITLEMENT,
} from "../lib/billing";
import { Button, Notice, Page } from "../ui/components";
import { colors, fonts, ui } from "../ui/design";
export default function FreelaPlus() {
  const { user, role } = useSession();
  const { usage, sync, refresh } = useSubscription();
  const { width } = useWindowDimensions();
  const [offer, setOffer] = useState<PurchasesPackage | null>(null);
  const [loadingOffer, setLoadingOffer] = useState(billingAvailable);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const lock = useRef(false);
  const terms = process.env.EXPO_PUBLIC_TERMS_URL;
  const privacy = process.env.EXPO_PUBLIC_PRIVACY_URL;
  async function loadOffer() {
    if (!user || !billingAvailable) return;
    setLoadingOffer(true);
    try {
      setOffer(await monthlyPackage(user.id));
    } catch {
      setMessage("Não foi possível carregar o preço da loja. Tente novamente.");
    } finally {
      setLoadingOffer(false);
    }
  }
  useEffect(() => {
    void loadOffer();
  }, [user?.id]);
  async function purchase(restore = false) {
    if (lock.current || !user) return;
    lock.current = true;
    setBusy(true);
    setMessage("");
    try {
      const purchases = await billing(user.id);
      const info = restore
        ? await purchases.restorePurchases()
        : await presentFreelaPaywall(user.id);
      if (!info) return;
      if (!info.entitlements.active[REVENUECAT_ENTITLEMENT]) {
        setMessage(
          restore
            ? "Nenhuma assinatura ativa encontrada nesta conta da loja."
            : "A compra ainda não liberou o acesso. Se houver pagamento pendente, aguarde a confirmação.",
        );
        return;
      }
      await sync();
      const verified = await getUsage();
      setMessage(
        verified.premium
          ? "Freela+ ativo. Seus próximos orçamentos não têm limite."
          : "Compra recebida. A confirmação do seu plano ainda está sendo atualizada. Use “Atualizar plano” em instantes.",
      );
    } catch (error) {
      if (!(error as { userCancelled?: boolean })?.userCancelled)
        setMessage(
          "Não foi possível concluir. Se a compra já foi cobrada, use “Restaurar compra” para atualizar seu acesso.",
        );
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  async function manage() {
    if (!user || lock.current) return;
    lock.current = true;
    setBusy(true);
    try {
      const purchases = await billing(user.id);
      const url = (await purchases.getCustomerInfo()).managementURL;
      if (url) await Linking.openURL(url);
      else
        setMessage(
          "Gerencie ou cancele a assinatura nas configurações de assinaturas da loja em que comprou.",
        );
    } catch {
      setMessage(
        "Abra a área de assinaturas da App Store ou Google Play para gerenciar seu plano.",
      );
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  const legalReady =
    (isTestStore && __DEV__) ||
    (!!terms?.startsWith("https://") && !!privacy?.startsWith("https://"));
  return (
    <Page>
      {billingAvailable && isTestStore ? (
        <Text style={ui.small}>Modo de teste · nenhuma cobrança real.</Text>
      ) : null}
      <View style={ui.between}>
        <Text style={ui.label}>Freela+</Text>
        <View style={ui.badge}>
          <Text style={ui.small}>
            {usage?.premium
              ? "Seu plano está ativo"
              : "Mais liberdade para trabalhar"}
          </Text>
        </View>
      </View>
      <View
        style={[ui.hero, { padding: width > 700 ? 44 : width < 370 ? 20 : 26 }]}
      >
        <View
          style={{
            flexDirection: width > 760 ? "row" : "column",
            gap: 32,
            alignItems: "flex-start",
          }}
        >
          <View
            style={{
              flex: width > 760 ? 1 : undefined,
              gap: 20,
              maxWidth: "100%",
            }}
          >
            <View
              style={{
                width: 58,
                height: 58,
                borderRadius: 18,
                backgroundColor: colors.green,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Feather name="zap" size={30} color={colors.ink} />
            </View>
            <Text
              style={[
                ui.heroTitle,
                {
                  fontSize: width > 760 ? 54 : width < 370 ? 30 : 36,
                  lineHeight: width > 760 ? 58 : width < 370 ? 35 : 41,
                },
              ]}
            >
              Seu talento{"\n"}não tem limite.{"\n"}Seus orçamentos{"\n"}também
              não.
            </Text>
            <Text style={[ui.heroBody, { maxWidth: 380 }]}>
              Dê espaço para o próximo trabalho. Crie quantos orçamentos
              precisar com o Freela+.
            </Text>
          </View>
          <View
            style={{
              width: width > 760 ? 320 : "100%",
              backgroundColor: colors.white,
              borderRadius: 20,
              padding: width < 370 ? 18 : 26,
              gap: 20,
            }}
          >
            <Text style={ui.heading}>Freela+</Text>
            <View>
              <Text
                style={{
                  fontFamily: fonts.bold,
                  fontSize: width < 370 ? 34 : 44,
                  letterSpacing: -2,
                  color: colors.ink,
                }}
              >
                {offer?.product.priceString ?? "R$ 14,99"}
              </Text>
              <Text style={ui.body}>por mês · assinatura mensal</Text>
            </View>
            <View style={ui.divider} />
            {[
              "Orçamentos sem limite mensal",
              "Histórico dos seus orçamentos",
              "Compartilhamento com clientes",
            ].map((text) => (
              <View key={text} style={ui.row}>
                <Feather name="check" color={colors.success} size={19} />
                <Text style={[ui.body, { flex: 1, color: colors.ink }]}>
                  {text}
                </Text>
              </View>
            ))}
            {role !== "profissional" ? (
              <Text style={ui.body}>Disponível para contas profissionais.</Text>
            ) : usage?.premium ? (
              <Button
                title="Criar um orçamento"
                onPress={() => router.push("/novo-orcamento")}
              />
            ) : (
              <Button
                title={loadingOffer ? "Buscando preço…" : "Assinar Freela+"}
                busy={busy || loadingOffer}
                disabled={!offer || !legalReady}
                onPress={() => void purchase()}
              />
            )}
            {!billingAvailable ? (
              <Text style={ui.small}>
                A assinatura será disponibilizada no app para Android e iOS.
                Você pode conhecer o plano por aqui.
              </Text>
            ) : !offer || !legalReady ? (
              <Text style={ui.small}>
                As assinaturas ainda não estão disponíveis. Tente novamente mais
                tarde.
              </Text>
            ) : null}
            <Text style={ui.small}>
              Renovação automática mensal. Cancele a qualquer momento pela loja.
              O acesso continua até o fim do período pago.
            </Text>
          </View>
        </View>
      </View>
      {message ? <Notice>{message}</Notice> : null}
      <View style={{ gap: 16 }}>
        <Text style={ui.heading}>Escolha o ritmo do seu negócio.</Text>
        <View style={[ui.card, { padding: 0, overflow: "hidden" }]}>
          {[
            ["O que está incluído", "Grátis", "Freela+"],
            ["Orçamentos por mês", "5", "Ilimitados"],
            ["Histórico e compartilhamento", "Sim", "Sim"],
            ["Mensalidade", "R$ 0", offer?.product.priceString ?? "R$ 14,99"],
          ].map((row, i) => (
            <View
              key={row[0]}
              style={{
                flexDirection: "row",
                padding: 18,
                gap: 8,
                backgroundColor: i === 0 ? colors.lavender : colors.white,
                borderBottomWidth: i < 3 ? 1 : 0,
                borderBottomColor: colors.line,
              }}
            >
              <Text style={[i === 0 ? ui.label : ui.body, { flex: 1.5 }]}>
                {row[0]}
              </Text>
              <Text style={[ui.label, { flex: 0.8, textAlign: "center" }]}>
                {row[1]}
              </Text>
              <Text style={[ui.label, { flex: 1, textAlign: "right" }]}>
                {row[2]}
              </Text>
            </View>
          ))}
        </View>
        <Text style={ui.small}>
          A franquia grátis renova no primeiro dia de cada mês, no horário de
          Brasília. Orçamentos não usados não acumulam. Seu histórico continua
          disponível após cancelar.
        </Text>
      </View>
      <View
        style={{ gap: 12, maxWidth: 560, width: "100%", alignSelf: "center" }}
      >
        {billingAvailable && role === "profissional" ? (
          <>
            <Button
              title="Restaurar compra"
              secondary
              busy={busy}
              onPress={() => void purchase(true)}
            />
            {usage?.premium ? (
              <Button
                title="Gerenciar assinatura"
                secondary
                busy={busy}
                onPress={() => void manage()}
              />
            ) : (
              <Button
                title="Buscar oferta novamente"
                secondary
                disabled={loadingOffer || busy}
                onPress={() => void loadOffer()}
              />
            )}
            <Button
              title="Atualizar plano"
              secondary
              disabled={busy}
              onPress={async () => {
                try {
                  await sync();
                  setMessage("Plano atualizado.");
                } catch {
                  setMessage("Não foi possível atualizar. Tente novamente.");
                }
              }}
            />
          </>
        ) : (
          <Button
            title="Atualizar plano"
            secondary
            onPress={() => void refresh()}
          />
        )}
        <View style={[ui.row, { justifyContent: "center", flexWrap: "wrap" }]}>
          {[
            [terms, "Termos de uso"],
            [privacy, "Privacidade"],
          ].map(([url, label]) =>
            url?.startsWith("https://") ? (
              <Pressable
                key={label}
                accessibilityRole="link"
                onPress={() => {
                  void Linking.openURL(url).catch(() =>
                    setMessage("Não foi possível abrir o link."),
                  );
                }}
                style={{ padding: 12 }}
              >
                <Text style={[ui.small, { textDecorationLine: "underline" }]}>
                  {label}
                </Text>
              </Pressable>
            ) : null,
          )}
        </View>
      </View>
    </Page>
  );
}
