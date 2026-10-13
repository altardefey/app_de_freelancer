import { useEffect, useRef, useState } from "react";
import { Share, Text, View } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Crypto from "expo-crypto";
import { router } from "expo-router";
import { useSession } from "../context/SessionContext";
import { useSubscription } from "../context/SubscriptionContext";
import { saveQuote, type Quote } from "../data/quotes";
import { parseAmount } from "../security/quoteAmount";
import { quoteText, currency } from "./ProfessionalHomeScreen";
import { Button, Field, Notice, Page } from "../ui/components";
import { ui } from "../ui/design";
type Draft = {
  client: string;
  whatsapp: string;
  service: string;
  amount: string;
  request_id: string;
};
const fresh = (): Draft => ({
  client: "",
  whatsapp: "",
  service: "",
  amount: "",
  request_id: Crypto.randomUUID(),
});
export default function NovoOrcamento() {
  const { user, role } = useSession();
  const { usage, refresh, error: planError } = useSubscription();
  const [draft, setDraft] = useState<Draft>(fresh);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState<Quote | null>(null);
  const lock = useRef(false);
  const writes = useRef(Promise.resolve());
  const key = "freela:quote-draft:" + user?.id;
  useEffect(() => {
    void refresh();
  }, [refresh]);
  useEffect(() => {
    let mounted = true;
    AsyncStorage.getItem(key)
      .then((raw) => {
        if (!mounted || !raw) return;
        const value = JSON.parse(raw);
        if (
          ["client", "whatsapp", "service", "amount", "request_id"].every(
            (k) => typeof value[k] === "string",
          )
        )
          setDraft(value);
      })
      .catch(() => {
        if (mounted) setError("Não foi possível recuperar seu rascunho.");
      })
      .finally(() => {
        if (mounted) setReady(true);
      });
    return () => {
      mounted = false;
    };
  }, [key]);
  useEffect(() => {
    if (!ready || saved || !user) return;
    writes.current = writes.current
      .catch(() => {})
      .then(() => AsyncStorage.setItem(key, JSON.stringify(draft)));
    void writes.current.catch(() =>
      setError(
        "Não foi possível salvar o rascunho neste aparelho. Mantenha esta tela aberta.",
      ),
    );
  }, [draft, ready, saved, key, user?.id]);
  function change(field: keyof Draft, value: string) {
    setDraft((old) => ({ ...old, [field]: value }));
  }
  async function save() {
    if (lock.current || !ready || !usage) return;
    const cents = parseAmount(draft.amount);
    if (!draft.client.trim() || !draft.service.trim() || cents === null)
      return setError(
        "Preencha cliente, serviço e um valor válido. Exemplo: 250,00.",
      );
    const phone = draft.whatsapp.replace(/\D/g, "");
    if (phone && !/^\d{10,11}$/.test(phone))
      return setError("Confira o WhatsApp com DDD ou deixe o campo vazio.");
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      const quote = await saveQuote({
        request_id: draft.request_id,
        client: draft.client.trim(),
        service: draft.service.trim(),
        amount_cents: cents!,
        whatsapp: phone || null,
      });
      setSaved(quote);
      await writes.current.catch(() => {});
      await AsyncStorage.removeItem(key).catch(() => {});
      await refresh();
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Não foi possível salvar. Tente novamente.",
      );
      await refresh();
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  if (role !== "profissional")
    return (
      <Page>
        <Text style={ui.heading}>Disponível para contas profissionais.</Text>
      </Page>
    );
  if (saved)
    return (
      <Page>
        <View style={ui.form}>
          <Text style={ui.title}>Pronto para fechar.</Text>
          <Text style={ui.body}>
            Seu orçamento foi salvo. Agora você pode compartilhar com o cliente.
          </Text>
          <View style={ui.card}>
            <Text style={ui.heading}>{saved.client}</Text>
            <Text style={ui.body}>{saved.service}</Text>
            <Text style={ui.title}>{currency(saved.amount_cents)}</Text>
          </View>
          <Button
            title="Compartilhar orçamento"
            icon="share-2"
            onPress={() => {
              void Share.share({ message: quoteText(saved) }).catch(() =>
                setError("Não foi possível compartilhar neste dispositivo."),
              );
            }}
          />
          <Button
            title="Ver meus orçamentos"
            secondary
            onPress={() => router.replace("/orcamentos")}
          />
          {error ? <Notice>{error}</Notice> : null}
        </View>
      </Page>
    );
  const limited = !!usage && !usage.premium && usage.used >= usage.limit;
  return (
    <Page>
      <View style={ui.form}>
        <Button
          title="Voltar aos orçamentos"
          secondary
          onPress={() => router.replace("/orcamentos")}
        />
        <Text style={ui.title}>Vamos colocar no papel.</Text>
        <Text style={ui.body}>
          Um orçamento claro é o primeiro passo para um bom serviço.
        </Text>
        <View style={ui.badge}>
          <Text style={ui.label}>
            {usage?.premium
              ? "Freela+ · orçamentos ilimitados"
              : usage
                ? usage.used + " de 5 orçamentos usados neste mês"
                : "Consultando sua franquia…"}
          </Text>
        </View>
        {limited ? (
          <>
            <Notice>
              Você chegou aos 5 orçamentos deste mês. Seu rascunho continua
              salvo.
            </Notice>
            <Button
              title="Criar sem limites com Freela+"
              onPress={() => router.push("/freela-plus")}
            />
            <Text style={ui.small}>
              Ou volte em{" "}
              {new Date(usage!.resetsAt).toLocaleDateString("pt-BR", {
                timeZone: "America/Sao_Paulo",
              })}
              , quando sua franquia renova.
            </Text>
          </>
        ) : null}
        {planError ? (
          <>
            <Notice>{planError}</Notice>
            <Button
              title="Consultar plano novamente"
              secondary
              onPress={() => void refresh()}
            />
          </>
        ) : null}
        <View style={ui.card}>
          <Field
            label="Nome do cliente"
            value={draft.client}
            onChangeText={(v) => change("client", v)}
            maxLength={120}
            editable={ready && !busy}
            placeholder="Para quem é este orçamento?"
          />
          <Field
            label="WhatsApp (opcional)"
            value={draft.whatsapp}
            onChangeText={(v) => change("whatsapp", v)}
            keyboardType="phone-pad"
            maxLength={20}
            editable={ready && !busy}
            placeholder="(11) 99999-9999"
          />
          <Field
            label="Descrição do serviço"
            value={draft.service}
            onChangeText={(v) => change("service", v)}
            multiline
            maxLength={2000}
            editable={ready && !busy}
            placeholder="O que está incluído no seu trabalho?"
          />
          <Field
            label="Valor total (R$)"
            value={draft.amount}
            onChangeText={(v) => change("amount", v)}
            keyboardType="decimal-pad"
            maxLength={14}
            editable={ready && !busy}
            placeholder="0,00"
          />
        </View>
        {error ? <Notice>{error}</Notice> : null}
        <Button
          title="Salvar orçamento"
          busy={busy}
          disabled={!ready || !usage || limited}
          onPress={() => void save()}
        />
        <Text style={ui.small}>
          Seu rascunho fica salvo neste aparelho. A franquia só é usada quando o
          orçamento é salvo.
        </Text>
      </View>
    </Page>
  );
}
