import { useLayoutEffect, useRef, useState } from "react";
import { Animated, Easing, Pressable, Text, View } from "react-native";
import { useReducedMotion } from "react-native-reanimated";
import { RegistrationPassword } from "../components/RegistrationPassword";
import { BirthDateField } from "../components/BirthDateField";
import { LegalConsent } from "../components/LegalConsent";
import { useSession } from "../context/SessionContext";
import { LocationFields } from "../components/LocationFields";
import { BotCheck } from "../components/BotCheck";
import { Logo } from "../components/Logo";
import { ServiceChoices } from "../components/ServiceChoices";
import { emptyLocation, type Role } from "../types/app";
import { password as validatePassword, validateBirthDate } from "../security/validation";
import { Button, Field, Notice, Page } from "../ui/components";
import { useAppearance } from "../ui/Appearance";

export function RegisterOnboarding() {
  const { colors, ui } = useAppearance();
  const { closeRegister, completeRegister } = useSession();
  const [birthDate, setBirthDate] = useState("");
  const [terms, setTerms] = useState(false);
  const [privacy, setPrivacy] = useState(false);
  const [step, setStep] = useState(0);
  const reducedMotion = useReducedMotion();
  const previousStep = useRef(step);
  const [progress] = useState(() => new Animated.Value(1));
  const [slide] = useState(() => new Animated.Value(0));

  useLayoutEffect(() => {
    const previous = previousStep.current;
    previousStep.current = step;
    if (reducedMotion || previous === step) {
      progress.setValue(step + 1);
      slide.setValue(0);
      return;
    }

    slide.setValue(step > previous ? 1 : -1);
    const easing = Easing.out(Easing.cubic);
    const fill = Animated.timing(progress, { toValue: step + 1, duration: 340, easing, useNativeDriver: false });
    const panel = Animated.timing(slide, { toValue: 0, duration: 340, easing, useNativeDriver: true });
    fill.start();
    panel.start();
    return () => {
      fill.stop();
      panel.stop();
    };
  }, [step, progress, slide, reducedMotion]);
  const [role, setRole] = useState<Role>("profissional");
  const [location, setLocation] = useState(emptyLocation);
  const [services, setServices] = useState<string[]>([]);
  const [firstName, setFirstName] = useState("");
  const [email, setEmail] = useState("");
  const [passwordAttempt, setPasswordAttempt] = useState(0);
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
    if (step === 2 && !services.length)
      return setMessage("Escolha um serviço ou descreva uma opção válida.");
    if (step < 3) return setStep(step + 1);
    try {
      validatePassword(password, true);
    } catch (error) {
      setPasswordAttempt((attempt) => attempt + 1);
      return setMessage((error as Error).message);
    }
    if (!firstName.trim()) return setMessage("Informe seu primeiro nome.");
    if (!/^\d{10,11}$/.test(whatsapp.replace(/\D/g, "")))
      return setMessage("Informe o WhatsApp com DDD.");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()))
      return setMessage("Informe um e-mail válido.");
    if (process.env.EXPO_PUBLIC_TURNSTILE_SITE_KEY && !token)
      return setMessage("Conclua a verificação de segurança.");
    try { validateBirthDate(birthDate, role); } catch (error) { return setMessage((error as Error).message); }
    if (!terms || !privacy) return setMessage("Aceite os Termos de Uso e confirme a ciência da Política de Privacidade.");
    lock.current = true;
    setBusy(true);
    try {
      const result = await completeRegister({
        role,
        location,
        email,
        firstName,
        password,
        whatsapp,
        services,
        captchaToken: token,
        birthDate, terms, privacy,
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
          <View style={ui.row} accessibilityRole="progressbar" accessibilityLabel="Progresso do cadastro"
            accessibilityValue={{ min: 0, max: 4, now: step + 1 }}>
            {[0, 1, 2, 3].map((index) => (
              <View key={index} style={{ height: 7, flex: 1, borderRadius: 4, overflow: "hidden", backgroundColor: colors.line }}>
                <Animated.View style={{
                  height: "100%",
                  borderRadius: 4,
                  backgroundColor: colors.purple,
                  width: progress.interpolate({ inputRange: [index, index + 1], outputRange: ["0%", "100%"], extrapolate: "clamp" }),
                }} />
              </View>
            ))}
          </View>
        </View>
        <View style={{ paddingBottom: step < 3 ? 14 : 0 }}>
          {[2, 1].filter((depth) => step + depth < 4).map((depth) => (
            <View key={depth} pointerEvents="none" style={{ position: "absolute", top: 12, bottom: (2 - depth) * 6, left: depth * 12, right: depth * 12, borderRadius: 16, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.lavender }} />
          ))}
          <Animated.View style={[ui.card, { borderRadius: 16, gap: 12, transform: [
            { perspective: 750 },
            { translateY: slide.interpolate({ inputRange: [-1, 0, 1], outputRange: [-24, 0, 34] }) },
            { rotateX: slide.interpolate({ inputRange: [-1, 0, 1], outputRange: ["-9deg", "0deg", "12deg"] }) },
            { scale: slide.interpolate({ inputRange: [-1, 0, 1], outputRange: [1.025, 1, 0.92] }) },
          ] }]}>
          <Text style={ui.title}>
            {
              [
                "Tipo de conta",
                "Localização",
                "Serviços",
                "Dados de acesso",
              ][step]
            }
          </Text>
          <Text style={ui.body}>
            {
              [
                "Escolha como você quer usar o Freela.",
                "O endereço ajuda a conectar pessoas da mesma região.",
                "Selecione os serviços que oferece ou procura.",
                "Informe seu primeiro nome, WhatsApp, e-mail e senha.",
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
                    style={({ pressed }) => [
                      ui.card,
                      {
                        backgroundColor:
                          role === item ? colors.lavender : colors.white,
                        borderColor: role === item ? colors.purple : colors.line,
                      transform: [{ scale: pressed && !reducedMotion ? 0.985 : 1 }],
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
                        ? "Publique serviços e envie orçamentos."
                        : "Busque serviços e solicite orçamentos."}
                    </Text>
                  </Pressable>
                ))
              : null}
            {step === 1 ? (
              <LocationFields value={location} onChange={setLocation} />
            ) : null}
            {step === 2 && <ServiceChoices values={services} onChange={setServices} />}
            {step === 3 ? (
              <>
                <Field label="Primeiro nome" value={firstName} onChangeText={setFirstName} maxLength={60} autoComplete="given-name" />
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
                <RegistrationPassword value={password} onChange={setPassword} attempt={passwordAttempt} onSubmit={() => void next()} disabled={busy || success} />
                <BirthDateField value={birthDate} onChange={setBirthDate} role={role} disabled={busy || success} />
                <LegalConsent {...{ terms, privacy, setTerms, setPrivacy }} />
                <BotCheck onToken={setToken} resetKey={reset} />
              </>
            ) : null}
          </View>
          </Animated.View>
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
