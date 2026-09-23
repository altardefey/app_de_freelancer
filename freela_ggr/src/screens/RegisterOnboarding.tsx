import Feather from "@expo/vector-icons/Feather";
import { type ReactNode, useEffect, useMemo, useState } from "react";
import {
  Pressable,
  ScrollView,
  type StyleProp,
  Text,
  TextInput,
  type ViewStyle,
  useWindowDimensions,
  View,
} from "react-native";
import Animated, {
  Easing,
  FadeInLeft,
  FadeOutLeft,
  interpolate,
  interpolateColor,
  ReduceMotion,
  type SharedValue,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";

import { AnimatedCheckbox } from "../components/AnimatedCheckbox";
import { LocationFields } from "../components/LocationFields";
import { LoginOrbs } from "../components/LoginOrbs";
import { useSession } from "../context/SessionContext";
import {
  findForbiddenService,
  OTHER_SERVICE_LABEL,
  SERVICE_OPTIONS,
} from "../data/serviceOptions";
import { emptyLocation } from "../types/app";
import { normalize } from "../utils/searchTools";
import { registerStyles as styles } from "./RegisterOnboarding.styles";

const STEP_COUNT = 4;
const DOT_SIZE = 10;
const GAP = DOT_SIZE * 2;
const PROGRESS_SIZE = DOT_SIZE * 2.6;
const LEFT_SPACE = -(PROGRESS_SIZE - DOT_SIZE) / 2;
const APP_GREEN = "#CCFF00";

// controla o pulinho dos cards e botões
const SPRING_CONFIG = {
  mass: 1,
  damping: 16,
  stiffness: 300,
  overshootClamping: false,
  restDisplacementThreshold: 0.01,
  restSpeedThreshold: 2,
  reduceMotion: ReduceMotion.System,
};

const FLOATING_ICONS: {
  name: keyof typeof Feather.glyphMap;
  y: number;
  side: "left" | "right";
  offset: number;
  delay: number;
}[] = [
  { name: "map-pin", y: 0.18, side: "left", offset: 18, delay: 0 },
  { name: "briefcase", y: 0.28, side: "right", offset: 12, delay: 280 },
  { name: "message-circle", y: 0.62, side: "left", offset: 16, delay: 520 },
  { name: "search", y: 0.7, side: "right", offset: 20, delay: 160 },
  { name: "home", y: 0.46, side: "right", offset: 8, delay: 400 },
];

// regras que aparecem no checklist da senha
const PASSWORD_RULES = [
  {
    key: "length",
    label: "Pelo menos 8 caracteres",
    test: (value: string) => value.length >= 8,
  },
  {
    key: "case",
    label: "Letras maiúsculas e minúsculas",
    test: (value: string) => /[a-z]/.test(value) && /[A-Z]/.test(value),
  },
  {
    key: "number",
    label: "Pelo menos 1 número",
    test: (value: string) => /\d/.test(value),
  },
  {
    key: "symbol",
    label: "Pelo menos 1 símbolo",
    test: (value: string) => /[^A-Za-z0-9]/.test(value),
  },
] as const;

type ShakeKey =
  | "role"
  | "location"
  | "services"
  | "customService"
  | "whatsapp"
  | "email"
  | "password";

type ShakeCounts = Record<ShakeKey, number>;

const emptyShakeCounts: ShakeCounts = {
  role: 0,
  location: 0,
  services: 0,
  customService: 0,
  whatsapp: 0,
  email: 0,
  password: 0,
};

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

function getPasswordStatus(value: string) {
  return PASSWORD_RULES.map((rule) => ({
    ...rule,
    met: rule.test(value),
  }));
}

function allPasswordRulesMet(value: string) {
  return getPasswordStatus(value).every((rule) => rule.met);
}

function formatWhatsapp(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 2) return digits;
  if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  if (digits.length <= 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  }
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

function digitsOnly(value: string) {
  return value.replace(/\D/g, "");
}

function FloatingIcon({
  name,
  y,
  side,
  offset,
  delay,
}: (typeof FLOATING_ICONS)[number]) {
  const { height } = useWindowDimensions();
  const drift = useSharedValue(0);

  useEffect(() => {
    drift.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 2200 + delay, easing: Easing.inOut(Easing.sin) }),
        withTiming(0, { duration: 2200 + delay, easing: Easing.inOut(Easing.sin) }),
      ),
      -1,
      false,
    );
  }, [delay, drift]);

  const style = useAnimatedStyle(() => ({
    transform: [
      { translateY: interpolate(drift.value, [0, 1], [-offset, offset]) },
      { rotate: `${interpolate(drift.value, [0, 1], [-8, 8])}deg` },
    ],
  }));

  const position =
    side === "left"
      ? { top: height * y, left: 10 }
      : { top: height * y, right: 10 };

  return (
    <Animated.View pointerEvents="none" style={[styles.floatingIcon, position, style]}>
      <Feather name={name} size={18} color="#CCFF00" />
    </Animated.View>
  );
}

function ShakeView({
  shakeKey,
  style,
  children,
}: {
  shakeKey: number;
  style?: StyleProp<ViewStyle>;
  children: ReactNode;
}) {
  // treme o bloco quando falta alguma informação
  const offset = useSharedValue(0);

  useEffect(() => {
    if (!shakeKey) return;
    offset.value = withSequence(
      withTiming(-8, { duration: 45 }),
      withTiming(8, { duration: 45 }),
      withTiming(-6, { duration: 45 }),
      withTiming(6, { duration: 45 }),
      withTiming(0, { duration: 45 }),
    );
  }, [offset, shakeKey]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: offset.value }],
  }));

  return <Animated.View style={[style, animatedStyle]}>{children}</Animated.View>;
}

function BouncyPressable({
  children,
  disabled,
  onPress,
  wrapperStyle,
  style,
  contentStyle,
}: {
  children: ReactNode;
  disabled?: boolean;
  onPress: () => void;
  wrapperStyle?: StyleProp<ViewStyle>;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
}) {
  // reaproveita a mesma animação de toque nos botões do app
  const scale = useSharedValue(1);
  const glow = useSharedValue(0);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: disabled ? 0.55 : 1,
    transform: [{ scale: scale.value }],
  }));

  const ringStyle = useAnimatedStyle(() => ({
    opacity: glow.value,
    transform: [{ scale: interpolate(glow.value, [0, 1], [0.94, 1.15]) }],
  }));

  function playPress() {
    scale.value = withSequence(
      withTiming(0.94, { duration: 80 }),
      withSpring(1, { damping: 16, stiffness: 260 }),
    );
    glow.value = withSequence(
      withTiming(1, { duration: 80 }),
      withDelay(40, withTiming(0, { duration: 360 })),
    );
  }

  return (
    <Animated.View style={[styles.bouncyWrap, wrapperStyle, animatedStyle]}>
      <Animated.View pointerEvents="none" style={[styles.tapRing, ringStyle]} />
      <Pressable
        disabled={disabled}
        onPress={() => {
          playPress();
          onPress();
        }}
        style={[style, contentStyle]}
      >
        {children}
      </Pressable>
    </Animated.View>
  );
}

function PasswordRequirement({
  label,
  met,
  shakeKey,
}: {
  label: string;
  met: boolean;
  shakeKey: number;
}) {
  // cada requisito muda de cor e treme se ainda não foi cumprido
  const offset = useSharedValue(0);

  useEffect(() => {
    if (!shakeKey || met) return;
    offset.value = withSequence(
      withTiming(-6, { duration: 45 }),
      withTiming(6, { duration: 45 }),
      withTiming(-4, { duration: 45 }),
      withTiming(4, { duration: 45 }),
      withTiming(0, { duration: 45 }),
    );
  }, [met, offset, shakeKey]);

  const rowStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: offset.value }],
  }));

  return (
    <Animated.View style={[styles.passwordRule, rowStyle]}>
      <Feather
        name={met ? "check-circle" : "circle"}
        size={13}
        color={met ? APP_GREEN : "#FFFFFF"}
      />
      <Text style={[styles.passwordRuleText, met && styles.passwordRuleTextMet]}>
        {label}
      </Text>
    </Animated.View>
  );
}

function Paginator({ animatedIndex }: { animatedIndex: SharedValue<number> }) {
  // mostra a etapa atual sem precisar de texto extra
  const progressStyle = useAnimatedStyle(() => ({
    width: interpolate(
      animatedIndex.value,
      [0, STEP_COUNT - 1],
      [
        PROGRESS_SIZE,
        STEP_COUNT * (DOT_SIZE + GAP) - GAP + PROGRESS_SIZE - DOT_SIZE,
      ],
    ),
    left: LEFT_SPACE,
  }));

  return (
    <View style={styles.paginator}>
      <Animated.View style={[styles.progressBar, progressStyle]} />
      {Array.from({ length: STEP_COUNT }).map((_, index) => (
        <PaginatorDot key={index} index={index} animatedIndex={animatedIndex} />
      ))}
    </View>
  );
}

function PaginatorDot({
  index,
  animatedIndex,
}: {
  index: number;
  animatedIndex: SharedValue<number>;
}) {
  const style = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(
      animatedIndex.value,
      [index - 1, index],
      ["#3F3F46", "#18181B"],
    ),
  }));
  return <Animated.View style={[styles.dot, style]} />;
}

export function RegisterOnboarding() {
  const { closeRegister, completeRegister } = useSession();
  const { width, height } = useWindowDimensions();
  const [index, setIndex] = useState(0);
  const [role, setRole] = useState<"cliente" | "profissional" | null>(null);
  const [location, setLocation] = useState(emptyLocation);
  const [serviceQuery, setServiceQuery] = useState("");
  const [selectedServices, setSelectedServices] = useState<string[]>([]);
  const [customService, setCustomService] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [shakeCounts, setShakeCounts] = useState<ShakeCounts>(emptyShakeCounts);
  const [passwordRulesShake, setPasswordRulesShake] = useState(0);
  const [registerError, setRegisterError] = useState("");
  const [registerSuccess, setRegisterSuccess] = useState("");
  const [saving, setSaving] = useState(false);
  const animatedIndex = useSharedValue(0);
  const steppedAhead = useSharedValue(0);
  const cardWidth = Math.min(width * 0.8, 440);
  const mainCollapsed = Math.min(width * 0.9, 420);
  const mainExpanded = Math.min(width * 0.67, 300);
  const subWidth = Math.min(width * 0.2, 88);

  const forbidden = findForbiddenService(customService);
  const passwordStatus = useMemo(() => getPasswordStatus(password), [password]);
  const visibleServices = useMemo(() => {
    const term = normalize(serviceQuery);
    return SERVICE_OPTIONS.filter((item) => normalize(item).includes(term));
  }, [serviceQuery]);

  // valida só a etapa atual antes de avançar
  const canContinue = () => {
    if (index === 0) return Boolean(role);
    if (index === 1) return Boolean(location.uf && location.city && location.neighborhood);
    if (index === 2) {
      const hasCatalog = selectedServices.some((item) => item !== OTHER_SERVICE_LABEL);
      const wantsOther = selectedServices.includes(OTHER_SERVICE_LABEL);
      if (wantsOther) {
        return customService.trim().length >= 3 && !forbidden;
      }
      return hasCatalog;
    }
    const phone = digitsOnly(whatsapp);
    return (
      (phone.length === 10 || phone.length === 11) &&
      isValidEmail(email) &&
      allPasswordRulesMet(password)
    );
  };

  const mainButtonStyle = useAnimatedStyle(() => ({
    width: interpolate(steppedAhead.value, [0, 1], [mainCollapsed, mainExpanded]),
  }));

  const backButtonStyle = useAnimatedStyle(() => ({
    width: interpolate(steppedAhead.value, [0, 1], [0, subWidth]),
    transform: [
      { translateX: interpolate(steppedAhead.value, [0, 1], [-subWidth, 0]) },
    ],
  }));

  function goTo(next: number) {
    setRegisterError("");
    setRegisterSuccess("");
    setIndex(next);
    animatedIndex.value = withSpring(next, SPRING_CONFIG);
    steppedAhead.value = withSpring(next === 0 ? 0 : 1, SPRING_CONFIG);
  }

  function shake(keys: ShakeKey[]) {
    setShakeCounts((current) => {
      const next = { ...current };
      keys.forEach((key) => {
        next[key] += 1;
      });
      return next;
    });
  }

  function showMissingFeedback() {
    // dá feedback visual no que está faltando
    if (index === 0) {
      if (!role) shake(["role"]);
      return;
    }

    if (index === 1) {
      if (!location.uf || !location.city || !location.neighborhood) {
        shake(["location"]);
      }
      return;
    }

    if (index === 2) {
      const hasCatalog = selectedServices.some((item) => item !== OTHER_SERVICE_LABEL);
      const wantsOther = selectedServices.includes(OTHER_SERVICE_LABEL);
      if (!hasCatalog && !wantsOther) {
        shake(["services"]);
        return;
      }
      if (wantsOther && (customService.trim().length < 3 || forbidden)) {
        shake(["customService"]);
      }
      return;
    }

    const missing: ShakeKey[] = [];
    const phone = digitsOnly(whatsapp);
    if (phone.length !== 10 && phone.length !== 11) missing.push("whatsapp");
    if (!isValidEmail(email)) missing.push("email");
    if (!allPasswordRulesMet(password)) {
      missing.push("password");
      setPasswordRulesShake((current) => current + 1);
    }
    shake(missing);
  }

  async function handleContinue() {
    if (!canContinue()) {
      showMissingFeedback();
      return;
    }
    if (index < STEP_COUNT - 1) {
      goTo(index + 1);
      return;
    }
    if (!role) return;
    // junta opções do catálogo com o campo livre de outro
    const services = selectedServices
      .filter((item) => item !== OTHER_SERVICE_LABEL)
      .concat(
        selectedServices.includes(OTHER_SERVICE_LABEL) ? [customService.trim()] : [],
      );

    setSaving(true);
    const result = await completeRegister({
      role,
      location,
      email,
      password,
      whatsapp,
      services,
    });
    setSaving(false);

    if (!result.success) {
      setRegisterError(result.message ?? "Cadastro não concluído. Confira os dados ou tente usar outro e-mail.");
      setRegisterSuccess("");
      return;
    }

    if (result.pendingConfirmation && result.message) {
      setRegisterSuccess(result.message);
      setRegisterError("");
    }
  }

  function toggleService(label: string) {
    setSelectedServices((current) =>
      current.includes(label)
        ? current.filter((item) => item !== label)
        : [...current, label],
    );
  }

  const titles = {
    0: {
      eyebrow: "PERFIL",
      title: "Como você quer se cadastrar?",
      subtitle: "Escolha se vai contratar ou oferecer serviços.",
    },
    1: {
      eyebrow: "LOCAL",
      title: "Onde você mora?",
      subtitle: "Informe o CEP ou escolha estado, cidade e bairro.",
    },
    2: {
      eyebrow: "SERVIÇOS",
      title:
        role === "profissional"
          ? "Quais serviços você oferece?"
          : "Que tipo de serviço você procura?",
      subtitle: "Pesquise, escolha uma ou mais opções, ou use Outro para descrever.",
    },
    3: {
      eyebrow: "CONTATO",
      title: "Como você vai acessar?",
      subtitle: "Informe WhatsApp, e-mail e senha para criar sua conta.",
    },
  } as const;

  const copy = titles[index as 0 | 1 | 2 | 3];

  return (
    <View style={styles.screen}>
      <LoginOrbs />
      {FLOATING_ICONS.map((icon) => (
        <FloatingIcon key={icon.name} {...icon} />
      ))}
      <BouncyPressable
        wrapperStyle={styles.close}
        style={styles.closePressable}
        onPress={closeRegister}
        contentStyle={styles.closeContent}
      >
        <Feather name="arrow-left" size={16} color="#A1A1AA" />
        <Text style={styles.closeText}>Voltar ao login</Text>
      </BouncyPressable>
      <View style={styles.inner}>
        <View style={[styles.cardWrap, { width }]}>
          <View style={[styles.card, { width: cardWidth, minHeight: Math.min(height * 0.56, 520) }]}>
            <Text style={styles.stepEyebrow}>{copy.eyebrow}</Text>
            <Text style={styles.stepTitle}>{copy.title}</Text>
            <Text style={styles.stepSubtitle}>{copy.subtitle}</Text>

            {index === 0 ? (
              <ShakeView shakeKey={shakeCounts.role} style={styles.roleRow}>
                <BouncyPressable
                  style={[styles.roleButton, role === "cliente" && styles.roleButtonActive]}
                  onPress={() => setRole("cliente")}
                >
                  <View style={[styles.roleIcon, role === "cliente" && styles.roleIconActive]}>
                    <Feather
                      name="user"
                      size={18}
                      color={role === "cliente" ? "#18181B" : "#CCFF00"}
                    />
                  </View>
                  <View>
                    <Text style={styles.roleLabel}>Sou cliente</Text>
                    <Text style={styles.roleHint}>Quero contratar profissionais</Text>
                  </View>
                </BouncyPressable>
                <BouncyPressable
                  style={[
                    styles.roleButton,
                    role === "profissional" && styles.roleButtonActive,
                  ]}
                  onPress={() => setRole("profissional")}
                >
                  <View
                    style={[
                      styles.roleIcon,
                      role === "profissional" && styles.roleIconActive,
                    ]}
                  >
                    <Feather
                      name="briefcase"
                      size={18}
                      color={role === "profissional" ? "#18181B" : "#CCFF00"}
                    />
                  </View>
                  <View>
                    <Text style={styles.roleLabel}>Sou profissional</Text>
                    <Text style={styles.roleHint}>Quero oferecer meus serviços</Text>
                  </View>
                </BouncyPressable>
              </ShakeView>
            ) : null}

            {index === 1 ? (
              <ShakeView shakeKey={shakeCounts.location}>
                <LocationFields showStreet value={location} onChange={setLocation} />
              </ShakeView>
            ) : null}

            {index === 2 ? (
              <>
                <ShakeView shakeKey={shakeCounts.services}>
                  <View style={styles.searchBox}>
                    <Feather name="search" size={16} color="#71717A" />
                    <TextInput
                      value={serviceQuery}
                      onChangeText={setServiceQuery}
                      placeholder="Pesquisar serviço"
                      placeholderTextColor="#71717A"
                      style={styles.searchInput}
                    />
                  </View>
                  <ScrollView style={{ maxHeight: 210 }} keyboardShouldPersistTaps="handled">
                    <View style={styles.chips}>
                      {visibleServices.map((item) => (
                        <AnimatedCheckbox
                          key={item}
                          label={item}
                          checked={selectedServices.includes(item)}
                          onPress={() => toggleService(item)}
                        />
                      ))}
                      <AnimatedCheckbox
                        label={OTHER_SERVICE_LABEL}
                        checked={selectedServices.includes(OTHER_SERVICE_LABEL)}
                        onPress={() => toggleService(OTHER_SERVICE_LABEL)}
                      />
                    </View>
                  </ScrollView>
                </ShakeView>
                {selectedServices.includes(OTHER_SERVICE_LABEL) ? (
                  <ShakeView shakeKey={shakeCounts.customService}>
                    <TextInput
                      value={customService}
                      onChangeText={setCustomService}
                      placeholder="Descreva o serviço"
                      placeholderTextColor="#71717A"
                      style={styles.otherInput}
                    />
                    {forbidden ? (
                      <Text style={styles.errorText}>
                        Este serviço não é permitido na plataforma.
                      </Text>
                    ) : null}
                  </ShakeView>
                ) : null}
              </>
            ) : null}

            {index === 3 ? (
              <>
                <ShakeView shakeKey={shakeCounts.whatsapp}>
                  <TextInput
                    value={whatsapp}
                    onChangeText={(value) => {
                      setWhatsapp(formatWhatsapp(value));
                      setRegisterError("");
                      setRegisterSuccess("");
                    }}
                    placeholder="WhatsApp: (11) 99999-9999"
                    placeholderTextColor="#71717A"
                    keyboardType="phone-pad"
                    style={styles.input}
                  />
                </ShakeView>
                <ShakeView shakeKey={shakeCounts.email}>
                  <TextInput
                    value={email}
                    onChangeText={(value) => {
                      setEmail(value);
                      setRegisterError("");
                      setRegisterSuccess("");
                    }}
                    placeholder="E-mail"
                    placeholderTextColor="#71717A"
                    keyboardType="email-address"
                    autoCapitalize="none"
                    style={[styles.input, styles.stackedInput]}
                  />
                </ShakeView>
                <ShakeView shakeKey={shakeCounts.password}>
                  <TextInput
                    value={password}
                    onChangeText={(value) => {
                      setPassword(value);
                      setRegisterError("");
                      setRegisterSuccess("");
                    }}
                    placeholder="Senha"
                    placeholderTextColor="#71717A"
                    secureTextEntry
                    style={[styles.input, styles.stackedInput]}
                  />
                </ShakeView>
                <View style={styles.passwordRules}>
                  {passwordStatus.map((rule) => (
                    <PasswordRequirement
                      key={rule.key}
                      label={rule.label}
                      met={rule.met}
                      shakeKey={passwordRulesShake}
                    />
                  ))}
                </View>
                {registerError ? <Text style={styles.registerError}>{registerError}</Text> : null}
                {registerSuccess ? (
                  <Text style={styles.registerSuccess}>{registerSuccess}</Text>
                ) : null}
              </>
            ) : null}
          </View>
        </View>

        <Paginator animatedIndex={animatedIndex} />

        <View style={[styles.controls, { maxWidth: Math.min(width, 520) }]}>
          <Animated.View style={[styles.backButton, backButtonStyle]}>
            <BouncyPressable
              onPress={() => index > 0 && goTo(index - 1)}
              wrapperStyle={styles.controlButtonFill}
              style={styles.controlButtonFill}
              contentStyle={styles.controlButtonContent}
            >
              <Text style={styles.backButtonText}>Voltar</Text>
            </BouncyPressable>
          </Animated.View>
          <Animated.View style={[styles.mainButton, mainButtonStyle]}>
            <BouncyPressable
              onPress={handleContinue}
              disabled={saving}
              wrapperStyle={styles.controlButtonFill}
              style={styles.controlButtonFill}
              contentStyle={styles.mainButtonContent}
            >
              {index >= STEP_COUNT - 1 ? (
                <Animated.View
                  entering={FadeInLeft}
                  exiting={FadeOutLeft.duration(100)}
                  style={styles.check}
                >
                  <Feather name="check" size={12} color="#CCFF00" />
                </Animated.View>
              ) : null}
              <Text style={styles.mainButtonText}>
                {index >= STEP_COUNT - 1 ? (saving ? "Salvando..." : "Finalizar") : "Continuar"}
              </Text>
            </BouncyPressable>
          </Animated.View>
        </View>
      </View>
    </View>
  );
}
