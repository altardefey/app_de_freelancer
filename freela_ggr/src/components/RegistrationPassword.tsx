import { useEffect, useRef, useState } from "react";
import { AccessibilityInfo, Animated, Pressable, Text, View } from "react-native";
import Feather from "@expo/vector-icons/Feather";
import { passwordRules } from "../security/validation";
import { useAppearance } from "../ui/Appearance";
import { Field } from "../ui/components";

export function RegistrationPassword({ value, onChange, attempt, onSubmit, disabled }: {
  value: string;
  onChange: (value: string) => void;
  attempt: number;
  onSubmit: () => void;
  disabled: boolean;
}) {
  const { colors, ui } = useAppearance();
  const [visible, setVisible] = useState(false);
  const [checked, setChecked] = useState(false);
  const offset = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!attempt) return;
    setChecked(true);
    let active = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((reduced) => {
      if (active && !reduced) {
        Animated.sequence([-5, 5, -3, 3, 0].map((toValue) =>
          Animated.timing(offset, { toValue, duration: 45, useNativeDriver: true }),
        )).start();
      }
    }).catch(() => {});
    return () => { active = false; offset.stopAnimation(); offset.setValue(0); };
  }, [attempt, offset]);

  return <View style={{ gap: 10 }}>
    <Field label="Senha" value={value} onChangeText={(text) => { setChecked(false); onChange(text); }}
      secureTextEntry={!visible} autoComplete="new-password" autoCapitalize="none" autoCorrect={false} maxLength={32}
      editable={!disabled} returnKeyType="done" onSubmitEditing={onSubmit} />
    <Pressable accessibilityRole="checkbox" aria-checked={visible} onPress={() => setVisible(!visible)}
      style={[ui.row, { minHeight: 44, alignSelf: "flex-start" }]}>
      <Feather name={visible ? "eye-off" : "eye"} size={18} color={colors.purple} />
      <Text style={ui.label}>{visible ? "Ocultar senha" : "Mostrar senha"}</Text>
    </Pressable>
    <View style={{ backgroundColor: "#312444", borderRadius: 12, padding: 14, gap: 7 }}>
      <Text style={[ui.label, { color: "#FFFFFF" }]}>Requisitos da senha</Text>
      {passwordRules.map(({ label, check }) => {
        const met = check(value);
        const color = met ? "#9FE870" : checked ? "#FFB4C1" : "rgba(255,255,255,0.72)";
        return <Animated.View key={label} style={[ui.row, !met && { transform: [{ translateX: offset }] }]}
          accessible accessibilityLabel={label + (met ? ", cumprido" : ", pendente")}>
          <Feather name={met ? "check-circle" : checked ? "alert-circle" : "circle"} size={15} color={color} />
          <Text style={[ui.small, { color, flex: 1 }]}>{label}</Text>
        </Animated.View>;
      })}
    </View>
  </View>;
}
