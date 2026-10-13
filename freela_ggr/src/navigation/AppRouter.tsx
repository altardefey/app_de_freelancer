import { View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useSession } from "../context/SessionContext";
import { ClientHomeScreen } from "../screens/ClientHomeScreen";
import { LoginScreen } from "../screens/LoginScreen";
import { ProfessionalHomeScreen } from "../screens/ProfessionalHomeScreen";
import { RegisterOnboarding } from "../screens/RegisterOnboarding";
import { Shell } from "../ui/Shell";
import { ui } from "../ui/design";
export function AppRouter() {
  const { role, authScreen, user } = useSession();
  if (!role)
    return (
      <SafeAreaView style={ui.page}>
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
  return (
    <Shell>
      {role === "cliente" ? (
        <ClientHomeScreen key={user?.id} />
      ) : (
        <ProfessionalHomeScreen key={user?.id} />
      )}
    </Shell>
  );
}
