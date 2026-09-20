import { SessionProvider, useSession } from "../context/SessionContext";
import { ClientHomeScreen } from "../screens/ClientHomeScreen";
import { LoginScreen } from "../screens/LoginScreen";
import { ProfessionalHomeScreen } from "../screens/ProfessionalHomeScreen";
import { RegisterOnboarding } from "../screens/RegisterOnboarding";

function AppFlow() {
  const { role, authScreen } = useSession();

  if (!role) {
    return authScreen === "register" ? <RegisterOnboarding /> : <LoginScreen />;
  }

  return role === "cliente" ? <ClientHomeScreen /> : <ProfessionalHomeScreen />;
}

export function AppRouter() {
  return (
    <SessionProvider>
      <AppFlow />
    </SessionProvider>
  );
}
