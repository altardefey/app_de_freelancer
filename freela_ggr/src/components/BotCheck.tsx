import { Text, View } from "react-native";
import { WebView } from "react-native-webview";
export type BotCheckProps = { onToken: (token: string | undefined) => void; resetKey: number };
export function BotCheck({ onToken, resetKey }: BotCheckProps) {
  const sitekey = process.env.EXPO_PUBLIC_TURNSTILE_SITE_KEY;
  const origin = process.env.EXPO_PUBLIC_WEB_ORIGIN;
  if (!sitekey) return null;
  if (!origin?.startsWith("https://")) return <Text>Verificação indisponível. Tente novamente mais tarde.</Text>;
  return <View style={{ height: 110, width: "100%" }}><WebView
    key={resetKey}
    source={{ uri: `${origin}/security-check.html?sitekey=${encodeURIComponent(sitekey)}` }}
    originWhitelist={[origin, "https://challenges.cloudflare.com"]}
    mixedContentMode="never"
    allowFileAccess={false}
    sharedCookiesEnabled={false}
    onMessage={event => {
      const token = event.nativeEvent.data;
      onToken(token && token.length <= 4096 ? token : undefined);
    }}
    onError={() => onToken(undefined)}
  /></View>;
}
