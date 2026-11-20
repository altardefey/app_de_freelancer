import { View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useSession } from "../context/SessionContext";
import { ClientHomeScreen } from "../screens/ClientHomeScreen";
import { LoginScreen } from "../screens/LoginScreen";
import { ProfessionalHomeScreen } from "../screens/ProfessionalHomeScreen";
import { RegisterOnboarding } from "../screens/RegisterOnboarding";
import { Shell } from "../ui/Shell";
import { HeaderTools, LoadingScreen, useAppearance } from "../ui/Appearance";
export function AppRouter() {
  const { role, authScreen, user, loading } = useSession();
  const { ui } = useAppearance();
  if (loading) return <LoadingScreen />;
  if (!role)
    return (
      <SafeAreaView style={ui.page}>
        <HeaderTools />
        <View
          style={{ flex: 1, display: authScreen === "login" ? "flex" : "none" }}
        >
          <LoginScreen />
        </View>
        <View
          style={{
            flex: 1,
            display: authScreen === "register" ? "flex" : "none",
          }}
        >
          <RegisterOnboarding />
        </View>
      </SafeAreaView>
    );
  if (role === "cliente") return <ClientHomeScreen key={user?.id} />;
  return <Shell><ProfessionalHomeScreen key={user?.id} /></Shell>;
}
