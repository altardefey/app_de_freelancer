import { useRef, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import Feather from "@expo/vector-icons/Feather";
import { Logo } from "../components/Logo";
import { BotCheck } from "../components/BotCheck";
import { useSession } from "../context/SessionContext";
import { Button, Field, Notice, Page } from "../ui/components";
import { colors, fonts, ui } from "../ui/design";
import type { Role } from "../types/app";

export function LoginScreen() {
  const { login, resendConfirmation, loading, openRegister } = useSession();
  const { width } = useWindowDimensions();
  const [role, setRole] = useState<Role>("profissional");
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
            role,
            email: email.trim(),
            password,
            captchaToken: token,
          });
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
  if (loading)
    return (
      <Page>
        <Logo />
        <ActivityIndicator color={colors.purple} />
      </Page>
    );
  return (
    <Page>
      <View style={ui.between}>
        <Logo />
        <Text style={ui.small}>Seu trabalho. Seu próximo passo.</Text>
      </View>
      <View
        style={{
          flexDirection: width >= 850 ? "row" : "column",
          gap: 32,
          alignItems: "stretch",
          marginTop: width >= 850 ? 32 : 0,
        }}
      >
        <View
          style={[
            ui.hero,
            {
              flex: width >= 850 ? 1 : undefined,
              justifyContent: "space-between",
              minHeight: width >= 850 ? 550 : undefined,
            },
          ]}
        >
          <View style={{ gap: 20 }}>
            <View
              style={[
                ui.badge,
                { alignSelf: "flex-start", backgroundColor: "#362D49" },
              ]}
            >
              <Text style={[ui.label, { color: colors.green }]}>
                Mais espaço para o seu talento
              </Text>
            </View>
            <Text
              style={[
                ui.heroTitle,
                {
                  fontSize: width >= 850 ? 56 : 32,
                  lineHeight: width >= 850 ? 59 : 37,
                },
              ]}
            >
              Bom trabalho.{"\n"}Novos caminhos.
            </Text>
            <Text style={[ui.heroBody, { maxWidth: 360 }]}>
              Encontre profissionais perto de você ou transforme suas
              habilidades no próximo serviço fechado.
            </Text>
          </View>
          <View
            style={{
              marginTop: 28,
              gap: 12,
              display: width >= 850 ? "flex" : "none",
            }}
          >
            <View style={{ height: 1, backgroundColor: "#4C405F" }} />
            <View style={ui.row}>
              <Feather name="file-text" size={22} color={colors.green} />
              <Text style={ui.heroBody}>Do primeiro contato ao orçamento.</Text>
            </View>
          </View>
        </View>
        <View
          style={[
            ui.card,
            {
              flex: width >= 850 ? 1 : undefined,
              justifyContent: "center",
              padding: width >= 850 ? 36 : 24,
              gap: 22,
            },
          ]}
        >
          <View style={{ gap: 8 }}>
            <Text style={ui.title}>Vamos começar?</Text>
            <Text style={ui.body}>Entre na sua conta para continuar.</Text>
          </View>
          <View
            accessibilityRole="tablist"
            style={[
              ui.row,
              { backgroundColor: colors.canvas, borderRadius: 28, padding: 4 },
            ]}
          >
            {(["profissional", "cliente"] as Role[]).map((item) => (
              <Pressable
                key={item}
                accessibilityRole="tab"
                accessibilityState={{ selected: role === item }}
                onPress={() => setRole(item)}
                style={{
                  flex: 1,
                  paddingVertical: 14,
                  borderRadius: 24,
                  alignItems: "center",
                  backgroundColor: role === item ? colors.ink : "transparent",
                }}
              >
                <Text
                  style={{
                    fontFamily: fonts.medium,
                    color: role === item ? colors.white : colors.muted,
                  }}
                >
                  {item === "cliente" ? "Sou cliente" : "Sou profissional"}
                </Text>
              </Pressable>
            ))}
          </View>
          <Field
            label="E-mail"
            value={email}
            onChangeText={setEmail}
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
          <Pressable
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
          </Pressable>
          <View style={ui.divider} />
          <Button
            title="Criar uma conta grátis"
            secondary
            onPress={openRegister}
          />
        </View>
      </View>
      <Text style={[ui.small, { textAlign: "center" }]}>
        Feito para quem faz acontecer.
      </Text>
    </Page>
  );
}
