import { useState } from "react";
import { Linking, Platform, Text, View } from "react-native";
import { billing, billingAvailable } from "../lib/billing";
import { useAppearance } from "../ui/Appearance";
import { Button, Notice } from "../ui/components";

export function SubscriptionCancellation({ userId }: { userId: string }) {
  const { ui } = useAppearance();
  const [expanded, setExpanded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  function open(url: string) {
    setError("");
    return Linking.openURL(url).catch(() => setError("Não foi possível abrir a loja. Tente novamente."));
  }

  async function manage() {
    if (busy) return;
    if (Platform.OS !== "web" && billingAvailable) {
      setBusy(true);
      try {
        const url = (await (await billing(userId)).getCustomerInfo()).managementURL;
        if (url) {
          await open(url);
          return;
        }
      } catch {
        // a loja ainda pode ser aberta diretamente
      } finally {
        setBusy(false);
      }
    }
    setExpanded(true);
  }

  return <View style={{ gap: 8 }}>
    <Button title="Cancelar assinatura" secondary busy={busy} onPress={() => void manage()} />
    {expanded && <>
      <Text style={ui.small}>Abra a loja em que comprou o Freela+, selecione a assinatura e confirme o cancelamento.</Text>
      <Button title="Assinaturas da App Store" secondary onPress={() => void open("https://apps.apple.com/account/subscriptions")} />
      <Button title="Assinaturas do Google Play" secondary onPress={() => void open("https://play.google.com/store/account/subscriptions")} />
    </>}
    {error ? <Notice>{error}</Notice> : null}
  </View>;
}
