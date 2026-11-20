import { useRef, useState } from "react";
import { Modal, Platform, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { createRecoveryClient, supabase } from "../lib/supabase";
import { webApi } from "../lib/webApi";
import { accountPhone, email as validateEmail, password as validatePassword } from "../security/validation";
import { useAppearance } from "../ui/Appearance";
import { Button, Field, Notice, Page } from "../ui/components";
import { BotCheck } from "./BotCheck";
import { PasswordRecovery } from "./PasswordRecovery";

export function AccountCredentialEditor({ field, userId, email, close, onPhoneSaved }: {
  field: "email" | "password" | "phone"; userId: string; email: string; close: () => void; onPhoneSaved: (phone: string) => void;
}) {
  const { ui } = useAppearance();
  const [value, setValue] = useState("");
  const [password, setPassword] = useState("");
  const [captchaToken, setCaptchaToken] = useState<string>();
  const [resetKey, setResetKey] = useState(0);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const lock = useRef(false);

  async function save() {
    if (lock.current || field === "password") return;
    let updated: string;
    try {
      updated = field === "email" ? validateEmail(value) : accountPhone(value);
      validatePassword(password);
      if (field === "email" && updated.toLowerCase() === email.toLowerCase()) throw new Error("Informe um e-mail diferente do atual.");
    } catch (failure) {
      setError((failure as Error).message);
      return;
    }

    lock.current = true;
    setBusy(true);
    setError("");
    try {
      if (field === "phone") {
        let status: string;
        if (Platform.OS === "web") status = await webApi<string>("changeAccountPhone", { phone: updated, password });
        else {
          const result = await supabase.rpc("change_account_phone", { current_password: password, new_phone: updated });
          if (result.error) throw result.error;
          status = result.data;
        }
        if (status === "incorrect") return setError("A senha atual está incorreta.");
        if (status === "limited") return setError("Muitas tentativas. Aguarde alguns minutos antes de tentar de novo.");
        if (status !== "updated") throw new Error();
        onPhoneSaved(updated);
        close();
      } else {
        if (Platform.OS === "web") await webApi("changeAccountEmail", { email: updated, password, captchaToken });
        else {
          const { auth } = createRecoveryClient();
          const verified = await auth.signInWithPassword({ email, password, options: { captchaToken } });
          if (verified.error || verified.data.user?.id !== userId) return setError("Não foi possível confirmar sua senha. Confira os dados e tente novamente.");
          try {
            const result = await auth.updateUser({ email: updated });
            if (result.error) throw result.error;
          } finally {
            await auth.signOut({ scope: "local" }).catch(() => {});
          }
        }
        setSent(true);
      }
    } catch {
      setError("Não foi possível salvar a alteração. Confira os dados e tente novamente.");
    } finally {
      setPassword("");
      setCaptchaToken(undefined);
      setResetKey((key) => key + 1);
      lock.current = false;
      setBusy(false);
    }
  }

  return <Modal visible onRequestClose={() => { if (!busy) close(); }} animationType="slide">
    <SafeAreaView style={ui.page}>
      {field === "password" ? <PasswordRecovery initialEmail={email} accountEmail={email} close={close} /> :
        <Page><View style={[ui.form, ui.card]}>
          <Text accessibilityRole="header" style={ui.heading}>{field === "email" ? "Editar e-mail" : "Editar telefone"}</Text>
          {sent ? <Text style={ui.body}>Confira a caixa de entrada do e-mail atual e do novo endereço para confirmar a troca.</Text> : <>
            <Field label={field === "email" ? "Novo e-mail" : "Novo telefone com DDD"} value={value} onChangeText={setValue}
              autoCapitalize="none" keyboardType={field === "email" ? "email-address" : "phone-pad"} editable={!busy} />
            <Field label="Senha atual" value={password} onChangeText={setPassword} secureTextEntry autoComplete="current-password" editable={!busy} />
            {field === "email" && <BotCheck onToken={setCaptchaToken} resetKey={resetKey} />}
            {!!error && <Notice>{error}</Notice>}
            <Button title={field === "email" ? "Solicitar troca de e-mail" : "Salvar telefone"} onPress={() => void save()} busy={busy} />
          </>}
          <Button title="Fechar" secondary disabled={busy} onPress={close} />
        </View></Page>}
    </SafeAreaView>
  </Modal>;
}
