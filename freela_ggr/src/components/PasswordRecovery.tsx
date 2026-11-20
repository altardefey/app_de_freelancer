import { useRef, useState } from "react";
import { Linking, Platform, Text, View } from "react-native";
import { BotCheck } from "./BotCheck";
import { createRecoveryClient } from "../lib/supabase";
import { webApi } from "../lib/webApi";
import { email as validateEmail, password as validatePassword } from "../security/validation";
import { useAppearance } from "../ui/Appearance";
import { Button, Field, Notice, Page } from "../ui/components";

export function PasswordRecovery({ initialEmail, accountEmail, close }: { initialEmail: string; accountEmail?: string; close: () => void }) {
  const { colors, ui } = useAppearance();
  const [email, setEmail] = useState(initialEmail);
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [step, setStep] = useState<"email" | "code" | "done">("email");
  const [captchaToken, setCaptchaToken] = useState<string>();
  const [reset, setReset] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const lock = useRef(false);

  async function submit() {
    if (lock.current) return;
    let address: string;
    try {
      address = validateEmail(accountEmail ?? email);
      if (step === "code") {
        if (!/^\d{6,10}$/.test(code)) return setError("Digite o código numérico que chegou no seu e-mail.");
        validatePassword(password, true);
        if (password !== confirm) return setError("As duas senhas precisam ser iguais.");
      } else if (process.env.EXPO_PUBLIC_TURNSTILE_SITE_KEY && !captchaToken) {
        return setError("Conclua a verificação de segurança.");
      }
    } catch (err) {
      return setError((err as Error).message);
    }
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      if (Platform.OS === "web") {
        if (step === "email") await webApi("requestPasswordReset", { email: address, captchaToken });
        else await webApi("completePasswordReset", { email: address, code, password });
      } else {
        const { auth } = createRecoveryClient();
        if (step === "email") {
          const { error } = await auth.resetPasswordForEmail(address, { captchaToken });
          if (error && error.code !== "user_not_found") throw error;
        } else {
          const { data, error } = await auth.verifyOtp({ email: address, token: code, type: "recovery" });
          if (error || !data.session) throw error ?? { code: "otp_expired" };
          const updated = await auth.updateUser({ password });
          if (updated.error) throw updated.error;
          await auth.signOut({ scope: "global" }).catch(() => {});
        }
      }
      setStep(step === "email" ? "code" : "done");
      setCode("");
      setPassword("");
      setConfirm("");
    } catch (failure) {
      const reason = (failure as { code?: string; status?: number } | null);
      if (reason?.status === 429 || reason?.code === "PT429") {
        setError("Muitas tentativas. Aguarde um pouco antes de tentar novamente.");
      } else if (step === "email") {
        setError("Não foi possível enviar o código agora. Tente novamente em instantes.");
      } else if (reason?.code === "same_password") {
        setError("Escolha uma senha diferente da atual. Peça um novo código para tentar novamente.");
      } else if (reason?.code === "weak_password") {
        setError("Escolha uma senha mais forte e peça um novo código para tentar novamente.");
      } else if (reason?.code === "otp_expired") {
        setError("O código está incorreto, venceu ou já foi usado. Peça outro e use o do e-mail mais recente.");
      } else {
        setError("A troca de senha falhou. Peça um novo código e tente novamente.");
      }
    } finally {
      lock.current = false;
      setBusy(false);
      setCaptchaToken(undefined);
      setReset((n) => n + 1);
    }
  }

  return <Page><View style={[ui.form, ui.card]}>
    <Text style={ui.heading}>{step === "done" ? "Senha alterada" : accountEmail ? "Alterar senha" : "Recuperar minha senha"}</Text>
    {step === "email" && <>
      {accountEmail ? <Text style={ui.body}>O código será enviado para {accountEmail}.</Text> : <>
        <Text style={ui.body}>Digite o e-mail que você usou para criar sua conta.</Text>
        <Field label="E-mail" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" editable={!busy} />
      </>}
      <BotCheck onToken={setCaptchaToken} resetKey={reset} />
    </>}
    {step === "code" && <>
      <Text style={ui.body}>Se houver uma conta com esse e-mail, você receberá um código numérico. Confira também a pasta de spam.</Text>
      <Field label="Código do e-mail" value={code} onChangeText={(value) => setCode(value.replace(/\D/g, "").slice(0, 10))} keyboardType="number-pad" autoComplete="one-time-code" editable={!busy} />
      <Field label="Nova senha" value={password} onChangeText={setPassword} secureTextEntry autoComplete="new-password" maxLength={32} editable={!busy} />
      <Text style={ui.small}>Use 12 a 32 caracteres, com maiúscula, minúscula, número e símbolo.</Text>
      <Field label="Repita a nova senha" value={confirm} onChangeText={setConfirm} secureTextEntry maxLength={32} editable={!busy} />
      <Button title={accountEmail ? "Pedir outro código" : "Pedir outro código ou corrigir o e-mail"} secondary disabled={busy} onPress={() => { setStep("email"); setError(""); setCode(""); setPassword(""); setConfirm(""); }} />
    </>}
    {error ? <Notice>{error}</Notice> : null}
    {step === "done" ? <Text style={ui.body}>Entre com sua nova senha.</Text> :
      <Button title={step === "email" ? "Enviar código por e-mail" : "Salvar nova senha"} busy={busy} onPress={() => void submit()} />}
    {step !== "done" && <Text style={ui.body}>
      Não conseguiu recuperar a senha?{" "}
      <Text accessibilityRole="link" style={{ color: colors.purple, textDecorationLine: "underline" }} onPress={() => {
        void Linking.openURL("mailto:freela.support@gmail.com").catch(() => setError("Envie um e-mail para freela.support@gmail.com."));
      }}>Contate-nos</Text>
    </Text>}
    <Button title={accountEmail ? "Fechar" : "Voltar ao login"} secondary disabled={busy} onPress={close} />
  </View></Page>;
}
