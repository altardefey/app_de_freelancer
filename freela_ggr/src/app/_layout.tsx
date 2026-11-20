import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useFonts } from "expo-font";
import { Rubik_400Regular } from "@expo-google-fonts/rubik/400Regular";
import { Rubik_500Medium } from "@expo-google-fonts/rubik/500Medium";
import { Rubik_700Bold } from "@expo-google-fonts/rubik/700Bold";
import { Appearance, LoadingScreen, useAppearance } from "../ui/Appearance";
import { SessionProvider } from "../context/SessionContext";
import { SubscriptionProvider } from "../context/SubscriptionContext";
import { LegalGate } from "../components/LegalConsent";
export default function Layout() {
  const [loaded, error] = useFonts({
    Rubik_400Regular,
    Rubik_500Medium,
    Rubik_700Bold,
  });
  if (!loaded && !error) return <LoadingScreen />;
  return <Appearance><Routes /></Appearance>;
}
function Routes() {
  const { dark, colors } = useAppearance();
  return (
    <SessionProvider>
      <SubscriptionProvider>
        <StatusBar style={dark ? "light" : "dark"} />
        <LegalGate>
          <Stack
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: colors.canvas },
            }}
          />
        </LegalGate>
      </SubscriptionProvider>
    </SessionProvider>
  );
}
