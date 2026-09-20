import { SessionProvider, useSession } from "../context/SessionContext";
import { ClientHomeScreen } from "./ClientHomeScreen";
import { LoginScreen } from "./LoginScreen";
import { ProfessionalHomeScreen } from "./ProfessionalHomeScreen";
import { RegisterOnboarding } from "./RegisterOnboarding";

function AppRouter() {
  const { role, authScreen } = useSession();

  if (!role) {
    return authScreen === "register" ? <RegisterOnboarding /> : <LoginScreen />;
  }

  if (role === "cliente") return <ClientHomeScreen />;
  return <ProfessionalHomeScreen />;
}

export default function HomeScreen() {
  return (
    <SessionProvider>
      <AppRouter />
    </SessionProvider>
  );
}
