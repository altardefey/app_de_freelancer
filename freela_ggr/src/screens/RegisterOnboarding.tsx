import Feather from "@expo/vector-icons/Feather";
import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Pressable,
  ScrollView,
  Text,
  TextInput,
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
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";

import { LocationFields, type LocationValue } from "../components/LocationFields";
import { LoginOrbs } from "../components/LoginOrbs";
import {
  findForbiddenService,
  OTHER_SERVICE_LABEL,
  SERVICE_OPTIONS,
} from "../data/serviceOptions";
import { normalize } from "../utils/searchTools";
import { registerStyles as styles } from "./RegisterOnboarding.styles";

const STEP_COUNT = 4;
const DOT_SIZE = 10;
const GAP = DOT_SIZE * 2;
const PROGRESS_SIZE = DOT_SIZE * 2.6;
const LEFT_SPACE = -(PROGRESS_SIZE - DOT_SIZE) / 2;

const SPRING_CONFIG = {
  mass: 1,
  damping: 16,
  stiffness: 300,
  overshootClamping: false,
  restDisplacementThreshold: 0.01,
  restSpeedThreshold: 2,
  reduceMotion: ReduceMotion.System,
};

export type RegisterPayload = {
  role: "cliente" | "profissional";
  location: LocationValue;
  services: string[];
  whatsapp: string;
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

function Paginator({ animatedIndex }: { animatedIndex: SharedValue<number> }) {
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

export function RegisterOnboarding({
  onCancel,
  onComplete,
}: {
  onCancel: () => void;
  onComplete: (payload: RegisterPayload) => void;
}) {
  const { width, height } = useWindowDimensions();
  const [index, setIndex] = useState(0);
  const [role, setRole] = useState<"cliente" | "profissional" | null>(null);
  const [location, setLocation] = useState<LocationValue>({
    uf: "",
    stateName: "",
    city: "",
  });
  const [serviceQuery, setServiceQuery] = useState("");
  const [selectedServices, setSelectedServices] = useState<string[]>([]);
  const [customService, setCustomService] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const animatedIndex = useSharedValue(0);
  const steppedAhead = useSharedValue(0);
  const cardWidth = Math.min(width * 0.8, 440);
  const mainCollapsed = Math.min(width * 0.9, 420);
  const mainExpanded = Math.min(width * 0.67, 300);
  const subWidth = Math.min(width * 0.2, 88);

  const forbidden = findForbiddenService(customService);
  const visibleServices = useMemo(() => {
    const term = normalize(serviceQuery);
    return SERVICE_OPTIONS.filter((item) => normalize(item).includes(term));
  }, [serviceQuery]);

  const canContinue = () => {
    if (index === 0) return Boolean(role);
    if (index === 1) return Boolean(location.uf && location.city);
    if (index === 2) {
      const hasCatalog = selectedServices.some((item) => item !== OTHER_SERVICE_LABEL);
      const wantsOther = selectedServices.includes(OTHER_SERVICE_LABEL);
      if (wantsOther) {
        return customService.trim().length >= 3 && !forbidden;
      }
      return hasCatalog;
    }
    const phone = digitsOnly(whatsapp);
    return phone.length === 10 || phone.length === 11;
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
    setIndex(next);
    animatedIndex.value = withSpring(next, SPRING_CONFIG);
    steppedAhead.value = withSpring(next === 0 ? 0 : 1, SPRING_CONFIG);
  }

  function handleContinue() {
    if (!canContinue()) {
      Alert.alert("Quase lá", "Complete esta etapa para continuar.");
      return;
    }
    if (index < STEP_COUNT - 1) {
      goTo(index + 1);
      return;
    }
    if (!role) return;
    const services = selectedServices
      .filter((item) => item !== OTHER_SERVICE_LABEL)
      .concat(
        selectedServices.includes(OTHER_SERVICE_LABEL) ? [customService.trim()] : [],
      );
    onComplete({
      role,
      location,
      services,
      whatsapp: digitsOnly(whatsapp),
    });
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
      subtitle: "Selecione o estado e a cidade para encontrar gente perto de você.",
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
      title: "Qual seu WhatsApp?",
      subtitle: "Usamos este número para conectar você com segurança.",
    },
  } as const;

  const copy = titles[index as 0 | 1 | 2 | 3];

  return (
    <View style={styles.screen}>
      <LoginOrbs />
      {FLOATING_ICONS.map((icon) => (
        <FloatingIcon key={icon.name} {...icon} />
      ))}
      <Pressable style={styles.close} onPress={onCancel}>
        <Feather name="arrow-left" size={16} color="#A1A1AA" />
        <Text style={styles.closeText}>Voltar ao login</Text>
      </Pressable>
      <View style={styles.inner}>
        <View style={[styles.cardWrap, { width }]}>
          <View style={[styles.card, { width: cardWidth, minHeight: Math.min(height * 0.56, 520) }]}>
            <Text style={styles.stepEyebrow}>{copy.eyebrow}</Text>
            <Text style={styles.stepTitle}>{copy.title}</Text>
            <Text style={styles.stepSubtitle}>{copy.subtitle}</Text>

            {index === 0 ? (
              <View style={styles.roleRow}>
                <Pressable
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
                </Pressable>
                <Pressable
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
                </Pressable>
              </View>
            ) : null}

            {index === 1 ? <LocationFields value={location} onChange={setLocation} /> : null}

            {index === 2 ? (
              <>
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
                    {visibleServices.map((item) => {
                      const active = selectedServices.includes(item);
                      return (
                        <Pressable
                          key={item}
                          style={[styles.chip, active && styles.chipActive]}
                          onPress={() => toggleService(item)}
                        >
                          <Text style={[styles.chipText, active && styles.chipTextActive]}>
                            {item}
                          </Text>
                        </Pressable>
                      );
                    })}
                    <Pressable
                      style={[
                        styles.chip,
                        selectedServices.includes(OTHER_SERVICE_LABEL) && styles.chipActive,
                      ]}
                      onPress={() => toggleService(OTHER_SERVICE_LABEL)}
                    >
                      <Text
                        style={[
                          styles.chipText,
                          selectedServices.includes(OTHER_SERVICE_LABEL) &&
                            styles.chipTextActive,
                        ]}
                      >
                        {OTHER_SERVICE_LABEL}
                      </Text>
                    </Pressable>
                  </View>
                </ScrollView>
                {selectedServices.includes(OTHER_SERVICE_LABEL) ? (
                  <>
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
                  </>
                ) : null}
              </>
            ) : null}

            {index === 3 ? (
              <TextInput
                value={whatsapp}
                onChangeText={(value) => setWhatsapp(formatWhatsapp(value))}
                placeholder="(11) 99999-9999"
                placeholderTextColor="#71717A"
                keyboardType="phone-pad"
                style={styles.input}
              />
            ) : null}
          </View>
        </View>

        <Paginator animatedIndex={animatedIndex} />

        <View style={[styles.controls, { maxWidth: Math.min(width, 520) }]}>
          <Animated.View style={[styles.backButton, backButtonStyle]}>
            <Pressable
              onPress={() => index > 0 && goTo(index - 1)}
              style={{ width: "100%", height: "100%", alignItems: "center", justifyContent: "center" }}
            >
              <Text style={styles.backButtonText}>Voltar</Text>
            </Pressable>
          </Animated.View>
          <Animated.View style={[styles.mainButton, mainButtonStyle]}>
            <Pressable
              onPress={handleContinue}
              style={{
                width: "100%",
                height: "100%",
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
              }}
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
                {index >= STEP_COUNT - 1 ? "Finalizar" : "Continuar"}
              </Text>
            </Pressable>
          </Animated.View>
        </View>
      </View>
    </View>
  );
}
