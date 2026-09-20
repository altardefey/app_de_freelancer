import Feather from "@expo/vector-icons/Feather";
import { BlurView } from "expo-blur";
import { useState } from "react";
import {
  Pressable,
  ScrollView,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";

import { LoginActionButton } from "../components/LoginActionButton";
import { LoginOrbs } from "../components/LoginOrbs";
import { Logo } from "../components/Logo";
import { useSession } from "../context/SessionContext";
import type { Role } from "../types/app";
import { styles } from "./HomeScreen.styles";

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

export function LoginScreen() {
  const { width } = useWindowDimensions();
  const { login, loading, openRegister } = useSession();
  const [loginRole, setLoginRole] = useState<Role | null>(null);
  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState("");
  const [password, setPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleLogin() {
    if (!loginRole) return;
    setFormError("");

    if (!isValidEmail(email)) {
      setEmailError("Insira um e-mail válido.");
      return;
    }

    if (!password.trim()) {
      setPasswordError("Informe sua senha.");
      return;
    }

    setSubmitting(true);
    const result = await login({ role: loginRole, email, password });
    setSubmitting(false);

    if (!result.success) {
      setFormError(result.message ?? "Não foi possível entrar. Confira o e-mail, a senha e se o cadastro já foi confirmado.");
    }
  }

  if (loading) {
    return (
      <View style={styles.loginShell}>
        <LoginOrbs />
        <View style={styles.loadingScreen}>
          <Logo />
          <Text style={styles.demoText}>Carregando sessão...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.loginShell}>
      <LoginOrbs />
      <ScrollView
        contentContainerStyle={styles.loginPage}
        keyboardShouldPersistTaps="handled"
      >
        <View style={[styles.loginLayout, width < 760 && styles.loginLayoutMobile]}>
          <View style={styles.glassContainerLeft}>
            <BlurView intensity={40} tint="dark" style={styles.glassBlur}>
              <View style={[styles.loginIntro, width < 760 && styles.loginIntroMobile]}>
                <Logo />
                <Text style={styles.eyebrow}>PLATAFORMA DE SERVIÇOS</Text>
                <Text style={[styles.loginTitle, width < 760 && styles.loginTitleMobile]}>
                  Encontre quem resolve.
                </Text>
                <Text style={[styles.loginSubtitle, width < 760 && styles.loginSubtitleMobile]}>
                  Conectando clientes a profissionais confiáveis para fazer acontecer.
                </Text>
                <View style={styles.loginTrust}>
                  <Feather name="shield" size={16} color="#4F7D6B" />
                  <Text style={styles.loginTrustText}>
                    Profissionais avaliados pela comunidade
                  </Text>
                </View>
              </View>
            </BlurView>
          </View>

          <View style={[styles.loginCard, width < 760 && styles.loginCardMobile]}>
            {!loginRole ? (
              <>
                <Text style={styles.cardTitle}>Como você vai usar?</Text>
                <Text style={styles.loginChoiceSubtitle}>
                  Escolha seu perfil para continuar.
                </Text>
                <LoginActionButton
                  variant="lime"
                  icon="user"
                  actionDelay={220}
                  onPress={() => setLoginRole("cliente")}
                >
                  <Text style={styles.loginPrimaryButtonText}>Sou cliente</Text>
                </LoginActionButton>
                <LoginActionButton
                  variant="dark"
                  icon="briefcase"
                  actionDelay={220}
                  onPress={() => setLoginRole("profissional")}
                >
                  <Text style={styles.loginSecondaryButtonText}>Sou profissional</Text>
                </LoginActionButton>
                <Pressable onPress={openRegister}>
                  <Text style={styles.registerPrompt}>
                    Não é membro?{" "}
                    <Text style={styles.registerLink}>Registre-se!</Text>
                  </Text>
                </Pressable>
              </>
            ) : (
              <>
                <Pressable style={styles.backChoice} onPress={() => setLoginRole(null)}>
                  <Feather name="arrow-left" size={16} color="#71717A" />
                  <Text style={styles.backChoiceText}>Trocar perfil</Text>
                </Pressable>
                <Text style={styles.cardTitle}>
                  {loginRole === "cliente"
                    ? "Acesse como cliente"
                    : "Acesse como profissional"}
                </Text>
                <Text style={styles.label}>E-mail</Text>
                <TextInput
                  value={email}
                  onChangeText={(value) => {
                    setEmail(value);
                    if (emailError) setEmailError("");
                    if (formError) setFormError("");
                  }}
                  placeholder="seu@email.com"
                  placeholderTextColor="#71717A"
                  style={[styles.input, emailError ? styles.inputError : null]}
                  autoCapitalize="none"
                  keyboardType="email-address"
                />
                {emailError ? <Text style={styles.fieldError}>{emailError}</Text> : null}
                <Text style={styles.label}>Senha</Text>
                <TextInput
                  value={password}
                  onChangeText={(value) => {
                    setPassword(value);
                    if (passwordError) setPasswordError("");
                    if (formError) setFormError("");
                  }}
                  placeholder="Digite sua senha"
                  placeholderTextColor="#71717A"
                  style={[styles.input, passwordError ? styles.inputError : null]}
                  secureTextEntry
                />
                {passwordError ? <Text style={styles.fieldError}>{passwordError}</Text> : null}
                {formError ? <Text style={styles.formError}>{formError}</Text> : null}
                <LoginActionButton variant="lime" onPress={handleLogin}>
                  <Text style={styles.loginPrimaryButtonText}>
                    {submitting ? "Entrando..." : "Entrar"}
                  </Text>
                </LoginActionButton>
                <Text style={styles.demoText}>
                  Use um e-mail e senha válidos.
                </Text>
              </>
            )}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}
