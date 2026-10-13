import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import {
  useFonts,
  Rubik_400Regular,
  Rubik_500Medium,
  Rubik_700Bold,
} from "@expo-google-fonts/rubik";
import { ActivityIndicator, View } from "react-native";
import { SessionProvider } from "../context/SessionContext";
import { SubscriptionProvider } from "../context/SubscriptionContext";
import { colors } from "../ui/design";
export default function Layout() {
  const [loaded, error] = useFonts({
    Rubik_400Regular,
    Rubik_500Medium,
    Rubik_700Bold,
  });
  if (!loaded && !error)
    return (
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          backgroundColor: colors.canvas,
        }}
      >
        <ActivityIndicator color={colors.purple} />
      </View>
    );
  return (
    <SessionProvider>
      <SubscriptionProvider>
        <StatusBar style="dark" />
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: colors.canvas },
          }}
        />
      </SubscriptionProvider>
    </SessionProvider>
  );
}
