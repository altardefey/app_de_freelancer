import { useRef, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { useSession } from "../context/SessionContext";
import { LocationFields } from "../components/LocationFields";
import { BotCheck } from "../components/BotCheck";
import { Logo } from "../components/Logo";
import {
  SERVICE_OPTIONS,
  OTHER_SERVICE_LABEL,
  findForbiddenService,
} from "../data/serviceOptions";
import { emptyLocation, type Role } from "../types/app";
import { password as validatePassword } from "../security/validation";
import { Button, Field, Notice, Page } from "../ui/components";
import { colors, ui } from "../ui/design";

export function RegisterOnboarding() {
  const { closeRegister, completeRegister } = useSession();
  const [step, setStep] = useState(0);
  const [role, setRole] = useState<Role>("profissional");
  const [location, setLocation] = useState(emptyLocation);
  const [services, setServices] = useState<string[]>([]);
  const [query, setQuery] = useState("");
  const [custom, setCustom] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [message, setMessage] = useState("");
  const [success, setSuccess] = useState(false);
  const [busy, setBusy] = useState(false);
  const [token, setToken] = useState<string>();
  const [reset, setReset] = useState(0);
  const lock = useRef(false);
  async function next() {
    if (lock.current) return;
    setMessage("");
    if (
      step === 1 &&
      (!location.uf || !location.city || !location.neighborhood)
    )
      return setMessage("Informe seu estado, cidade e bairro.");
    if (
      step === 2 &&
      (!services.length ||
        (services.includes(OTHER_SERVICE_LABEL) &&
          (custom.trim().length < 3 || findForbiddenService(custom))))
    )
      return setMessage("Escolha um serviço ou descreva uma opção válida.");
    if (step < 3) return setStep(step + 1);
    if (!/^\d{10,11}$/.test(whatsapp.replace(/\D/g, "")))
      return setMessage("Informe o WhatsApp com DDD.");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()))
      return setMessage("Informe um e-mail válido.");
    try {
      validatePassword(password, true);
    } catch (error) {
      return setMessage((error as Error).message);
    }
    if (process.env.EXPO_PUBLIC_TURNSTILE_SITE_KEY && !token)
      return setMessage("Conclua a verificação de segurança.");
    lock.current = true;
    setBusy(true);
    try {
      const result = await completeRegister({
        role,
        location,
        email,
        password,
        whatsapp,
        services: services
          .filter((s) => s !== OTHER_SERVICE_LABEL)
          .concat(
            services.includes(OTHER_SERVICE_LABEL) ? [custom.trim()] : [],
          ),
        captchaToken: token,
      });
      setSuccess(result.success);
      setMessage(
        result.message ??
          (result.success
            ? "Cadastro concluído."
            : "Não foi possível concluir o cadastro."),
      );
    } catch {
      setMessage(
        "Não foi possível conectar. Seus campos foram mantidos. Tente novamente.",
      );
    } finally {
      lock.current = false;
      setBusy(false);
      setReset((n) => n + 1);
    }
  }
  return (
    <Page>
      <View style={ui.between}>
        <Logo />
        <Button title="Voltar ao login" secondary onPress={closeRegister} />
      </View>
      <View style={ui.form}>
        <View style={{ gap: 12 }}>
          <Text style={ui.small}>Etapa {step + 1} de 4</Text>
          <View style={ui.row}>
            {[0, 1, 2, 3].map((i) => (
              <View
                key={i}
                style={{
                  height: 5,
                  flex: 1,
                  borderRadius: 4,
                  backgroundColor: i <= step ? colors.purple : colors.line,
                }}
              />
            ))}
          </View>
        </View>
        <Text style={ui.title}>
          {
            [
              "Seu próximo passo começa aqui.",
              "Perto de você.",
              "Qual é a sua área?",
              "Uma conta, novas possibilidades.",
            ][step]
          }
        </Text>
        <Text style={ui.body}>
          {
            [
              "Escolha como você quer usar o Freela.",
              "O endereço ajuda a conectar pessoas da mesma região.",
              "Selecione os serviços que oferece ou procura.",
              "Faltam só seus dados de acesso.",
            ][step]
          }
        </Text>
        <View style={ui.card}>
          {step === 0
            ? (["profissional", "cliente"] as Role[]).map((item) => (
                <Pressable
                  key={item}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: role === item }}
                  onPress={() => setRole(item)}
                  style={[
                    ui.card,
                    {
                      backgroundColor:
                        role === item ? colors.lavender : colors.white,
                      borderColor: role === item ? colors.purple : colors.line,
                    },
                  ]}
                >
                  <Text style={ui.heading}>
                    {item === "profissional"
                      ? "Quero oferecer serviços"
                      : "Quero contratar"}
                  </Text>
                  <Text style={ui.body}>
                    {item === "profissional"
                      ? "Organize pedidos e crie seus orçamentos."
                      : "Encontre ajuda para tirar seus planos do papel."}
                  </Text>
                </Pressable>
              ))
            : null}
          {step === 1 ? (
            <LocationFields value={location} onChange={setLocation} />
          ) : null}
          {step === 2 ? (
            <>
              <Field
                label="Buscar serviço"
                value={query}
                onChangeText={setQuery}
                placeholder="Ex.: pintura"
              />
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                {[
                  ...SERVICE_OPTIONS.filter((s) =>
                    s.toLowerCase().includes(query.toLowerCase()),
                  ),
                  OTHER_SERVICE_LABEL,
                ].map((s) => (
                  <Pressable
                    key={s}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: services.includes(s) }}
                    onPress={() =>
                      setServices((old) =>
                        old.includes(s)
                          ? old.filter((x) => x !== s)
                          : old.length < 30
                            ? [...old, s]
                            : old,
                      )
                    }
                    style={[ui.chip, services.includes(s) && ui.chipActive]}
                  >
                    <Text
                      style={[
                        ui.label,
                        services.includes(s) && { color: colors.white },
                      ]}
                    >
                      {s}
                    </Text>
                  </Pressable>
                ))}
              </View>
              {services.includes(OTHER_SERVICE_LABEL) ? (
                <Field
                  label="Qual serviço?"
                  value={custom}
                  onChangeText={setCustom}
                  maxLength={100}
                />
              ) : null}
            </>
          ) : null}
          {step === 3 ? (
            <>
              <Field
                label="WhatsApp com DDD"
                value={whatsapp}
                onChangeText={setWhatsapp}
                keyboardType="phone-pad"
                maxLength={20}
                placeholder="(11) 99999-9999"
              />
              <Field
                label="E-mail"
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
                autoComplete="email"
              />
              <Field
                label="Senha"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                autoComplete="new-password"
                maxLength={32}
              />
              <Text style={ui.small}>
                Use 12 a 32 caracteres, com maiúscula, minúscula, número e
                símbolo.
              </Text>
              <BotCheck onToken={setToken} resetKey={reset} />
            </>
          ) : null}
        </View>
        {message ? (
          success ? (
            <Text
              accessibilityRole="alert"
              style={[ui.card, ui.body, { color: colors.success }]}
            >
              {message}
            </Text>
          ) : (
            <Notice>{message}</Notice>
          )
        ) : null}
        {!success ? (
          <Button
            title={step === 3 ? "Criar minha conta" : "Continuar"}
            busy={busy}
            onPress={() => void next()}
          />
        ) : (
          <Button title="Ir para o login" onPress={closeRegister} />
        )}
        {step > 0 && !success ? (
          <Button
            title="Etapa anterior"
            secondary
            disabled={busy}
            onPress={() => {
              setMessage("");
              setStep(step - 1);
            }}
          />
        ) : null}
        <Text style={ui.small}>
          Seu preenchimento é mantido enquanto você alterna entre cadastro e
          login nesta sessão.
        </Text>
      </View>
    </Page>
  );
}
