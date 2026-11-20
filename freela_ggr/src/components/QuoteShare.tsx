import { useRef, useState } from "react";
import { Linking, Platform, Text, View } from "react-native";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import { getBudgetContact } from "../data/remote";
import { Button, Field, Notice } from "../ui/components";
import { useAppearance } from "../ui/Appearance";
import { makeQuotePdf } from "./quotePdf.webFile";

const addressRequest = "Por favor, responda com o endereço completo onde o serviço será realizado, incluindo CEP, número e complemento, se houver.";
const standardMessage = "Olá! Segue o orçamento do serviço. Se tiver dúvidas, pode me chamar por aqui.";
const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (char) =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]!,
);

type ShareableQuote = { client: string; service: string; amount_cents: number; created_at: string; whatsapp?: string | null; remote?: boolean; note?: string | null; delivery?: string | null; details?: string | null };

export function QuoteShare({ quote, budgetId }: { quote: ShareableQuote; budgetId?: string }) {
  const { ui } = useAppearance();
  const [note, setNote] = useState(quote.note?.trim().slice(0, 600) || standardMessage);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const lock = useRef(false);
  const nativePdf = useRef<{ html: string; uri: string } | null>(null);
  const needsAddress = !quote.remote;
  const message = [note.trim() || standardMessage, quote.delivery ? "Prazo ou disponibilidade: " + quote.delivery : "", needsAddress ? addressRequest : ""].filter(Boolean).join("\n\n");

  async function preparePdf() {
    const amount = (quote.amount_cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
    const date = new Date(quote.created_at).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
    if (Platform.OS === "web") {
      const pdf = makeQuotePdf([
        "Freela — Orçamento\n" + date,
        "Cliente: " + quote.client,
        "Serviço\n" + quote.service,
        ...(quote.details ? ["Detalhes do pedido\n" + quote.details] : []),
        "Total: " + amount,
        message,
      ]);
      const url = URL.createObjectURL(pdf);
      const link = document.createElement("a");
      link.href = url;
      link.download = "orcamento-freela.pdf";
      document.body.appendChild(link);
      try {
        link.click();
      } finally {
        link.remove();
        window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
      }
      return null;
    }

    const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Orçamento Freela</title><style>
      body{font:16px system-ui;color:#1F1633;margin:42px;line-height:1.55}
      header{border-bottom:4px solid #9FE870;padding-bottom:12px}
      h1{margin:0} p{white-space:pre-wrap;overflow-wrap:anywhere} .total{font-size:26px;font-weight:bold}
      </style></head><body><header><strong>Freela</strong><h1>Orçamento</h1><small>${escapeHtml(date)}</small></header>
      <p>Cliente: ${escapeHtml(quote.client)}</p><h2>Serviço</h2><p>${escapeHtml(quote.service)}</p>
      ${quote.details ? "<h2>Detalhes do pedido</h2><p>" + escapeHtml(quote.details) + "</p>" : ""}
      <p class="total">Total: ${escapeHtml(amount)}</p><p>${escapeHtml(message)}</p></body></html>`;
    if (nativePdf.current?.html === html) return nativePdf.current.uri;
    const { uri } = await Print.printToFileAsync({ html });
    nativePdf.current = { html, uri };
    return uri;
  }

  async function sharePdf() {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      const uri = await preparePdf();
      if (uri) {
        if (!await Sharing.isAvailableAsync()) throw new Error();
        await Sharing.shareAsync(uri, { mimeType: "application/pdf", UTI: "com.adobe.pdf", dialogTitle: "Escolha o WhatsApp" });
      }
    } catch {
      setError("Não foi possível preparar ou compartilhar o PDF. Tente novamente.");
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }

  return (
    <View style={{ gap: 12 }}>
      <Field label="Mensagem para o cliente" value={note} onChangeText={setNote} maxLength={600} multiline />
      {needsAddress && <Text style={ui.body}>{addressRequest}</Text>}
      <Text style={ui.small}>{Platform.OS === "web"
        ? "Ao abrir o WhatsApp, o PDF é baixado. Use o clipe na conversa para anexar o arquivo à mensagem."
        : "O PDF é gerado ao abrir o WhatsApp. Depois de enviar a mensagem, volte aqui, toque em Compartilhar PDF e escolha a mesma conversa."}</Text>
      <Button title={budgetId ? "Abrir WhatsApp do cliente" : "Abrir mensagem no WhatsApp"} secondary disabled={busy} onPress={() => {
        if (lock.current) return;
        lock.current = true;
        setBusy(true);
        setError("");
        const chat = Platform.OS === "web" ? window.open("", "_blank") : null;
        if (chat) chat.opener = null;
        void (async () => {
          try {
            try {
              await preparePdf();
            } catch {
              chat?.close();
              setError("Não foi possível gerar o PDF. Tente novamente.");
              return;
            }
            const number = budgetId ? await getBudgetContact(budgetId) : quote.whatsapp;
            if (budgetId && !number) {
              chat?.close();
              setError("O cliente não compartilhou o WhatsApp neste pedido. A proposta está disponível no Freela.");
              return;
            }
            const url = `https://wa.me/${number ? "55" + number : ""}?text=${encodeURIComponent(message)}`;
            if (chat) chat.location.replace(url);
            else if (Platform.OS === "web") window.location.assign(url);
            else await Linking.openURL(url);
          } catch {
            chat?.close();
            setError("Não foi possível abrir o WhatsApp. Tente novamente.");
          } finally {
            lock.current = false;
            setBusy(false);
          }
        })();
      }} />
      <Button title={Platform.OS === "web" ? "Baixar PDF" : "Compartilhar PDF"} icon="share-2" busy={busy} onPress={() => void sharePdf()} />
      {error ? <Notice>{error}</Notice> : null}
    </View>
  );
}
