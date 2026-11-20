import type { ReactNode, Ref } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
  type TextInputProps,
} from "react-native";
import Feather from "@expo/vector-icons/Feather";
import { useAppearance } from "./Appearance";

export function Button({
  title,
  onPress,
  busy,
  disabled,
  secondary,
  icon,
}: {
  title: string;
  onPress: () => void;
  busy?: boolean;
  disabled?: boolean;
  secondary?: boolean;
  icon?: keyof typeof Feather.glyphMap;
}) {
  const { ui } = useAppearance();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{ disabled: disabled || busy, busy }}
      disabled={disabled || busy}
      onPress={onPress}
      style={({ pressed }) => [
        ui.button,
        secondary && ui.secondary,
        { opacity: disabled || busy ? 0.55 : pressed ? 0.8 : 1 },
      ]}
    >
      {busy ? (
        <ActivityIndicator color="#1F1633" />
      ) : icon ? (
        <Feather name={icon} size={19} color="#1F1633" />
      ) : null}
      <Text style={ui.buttonText}>{title}</Text>
    </Pressable>
  );
}
export function Field({ label, ...props }: TextInputProps & { label: string }) {
  const { colors, ui } = useAppearance();
  return (
    <View style={{ gap: 8 }}>
      <Text style={ui.label}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor={colors.muted}
        {...props}
        style={[
          ui.input,
          props.multiline && { minHeight: 112, textAlignVertical: "top" },
          props.style,
        ]}
      />
    </View>
  );
}
export function Page({ children, scrollRef }: { children: ReactNode; scrollRef?: Ref<ScrollView> }) {
  const { ui } = useAppearance();
  return (
    <KeyboardAvoidingView
      style={ui.page}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView
        ref={scrollRef}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={ui.content}
      >
        {children}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
export function Empty({
  title,
  text,
  icon = "inbox",
}: {
  title: string;
  text: string;
  icon?: keyof typeof Feather.glyphMap;
}) {
  const { colors, ui } = useAppearance();
  return (
    <View style={ui.empty}>
      <Feather name={icon} size={30} color={colors.purple} />
      <Text style={[ui.heading, { textAlign: "center" }]}>{title}</Text>
      <Text style={[ui.body, { textAlign: "center", maxWidth: 340 }]}>
        {text}
      </Text>
    </View>
  );
}
export function Notice({ children }: { children: ReactNode }) {
  const { ui } = useAppearance();
  return (
    <Text accessibilityRole="alert" style={ui.error}>
      {children}
    </Text>
  );
}
