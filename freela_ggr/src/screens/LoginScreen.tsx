import { useRef, useState } from "react";
import {
  Pressable,
  Text,
  View,
} from "react-native";
import { BotCheck } from "../components/BotCheck";
import { Logo } from "../components/Logo";
import { PasswordRecovery } from "../components/PasswordRecovery";
import { useSession } from "../context/SessionContext";
import { LoadingScreen, useAppearance } from "../ui/Appearance";
import { Button, Field, Notice, Page } from "../ui/components";

export function LoginScreen() {
  const { ui } = useAppearance();
  const { login, resendConfirmation, loading, openRegister } = useSession();
  const [recovering, setRecovering] = useState(false);
  const [confirmationPending, setConfirmationPending] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const [token, setToken] = useState<string>();
  const [reset, setReset] = useState(0);
  async function submit(resend = false) {
    if (lock.current) return;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()))
      return setMessage("Informe um e-mail válido.");
    if (!resend && !password) return setMessage("Informe sua senha.");
    if (process.env.EXPO_PUBLIC_TURNSTILE_SITE_KEY && !token)
      return setMessage("Conclua a verificação de segurança.");
    lock.current = true;
    setBusy(true);
    setMessage("");
    try {
      const result = resend
        ? await resendConfirmation(email.trim(), token)
        : await login({
            email: email.trim(),
            password,
            captchaToken: token,
          });
      if (!resend) setConfirmationPending(result.pendingConfirmation === true);
      if (result.message) setMessage(result.message);
    } catch {
      setMessage(
        "Não foi possível conectar. Confira sua conexão e tente novamente.",
      );
    } finally {
      lock.current = false;
      setBusy(false);
      setReset((value) => value + 1);
    }
  }
  if (loading) return <LoadingScreen />;
  if (recovering) return <PasswordRecovery initialEmail={email} close={() => setRecovering(false)} />;
  return (
    <Page>
      <View style={ui.form}>
        <Logo />
        <View style={ui.card}>
          <View style={{ gap: 8 }}>
            <Text style={ui.title}>Entre no Freela</Text>
            <Text style={ui.body}>Entre na sua conta para continuar.</Text>
          </View>
          <Field
            label="E-mail"
            value={email}
            onChangeText={(value) => { setEmail(value); setConfirmationPending(false); }}
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            placeholder="voce@exemplo.com"
          />
          <Field
            label="Senha"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoComplete="current-password"
            placeholder="Sua senha"
            onSubmitEditing={() => void submit()}
          />
          {message ? <Notice>{message}</Notice> : null}
          <BotCheck onToken={setToken} resetKey={reset} />
          <Button
            title={busy ? "Aguarde…" : "Entrar na minha conta"}
            busy={busy}
            onPress={() => void submit()}
            icon="arrow-right"
          />
          <Button title="Esqueci minha senha" secondary disabled={busy} onPress={() => { setToken(undefined); setMessage(""); setRecovering(true); }} />
          {confirmationPending && <Pressable
            accessibilityRole="button"
            disabled={busy}
            onPress={() => void submit(true)}
            style={{ minHeight: 44, justifyContent: "center" }}
          >
            <Text
              style={[
                ui.small,
                { textAlign: "center", textDecorationLine: "underline" },
              ]}
            >
              Reenviar e-mail de confirmação
            </Text>
          </Pressable>}
          <View style={ui.divider} />
          <Button
            title="Criar uma conta grátis"
            secondary
            onPress={openRegister}
          />
        </View>
      </View>
    </Page>
  );
}
