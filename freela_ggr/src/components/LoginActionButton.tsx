import { type ReactNode } from "react";
import { Pressable, Text, View } from "react-native";
import Feather from "@expo/vector-icons/Feather";
import Animated, {
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from "react-native-reanimated";

import { styles } from "../screens/HomeScreen.styles";

export function LoginActionButton({
  children,
  variant,
  icon,
  onPress,
  actionDelay = 0,
}: {
  children: ReactNode;
  variant: "lime" | "dark";
  icon?: "user" | "briefcase";
  onPress: () => void;
  actionDelay?: number;
}) {
  const pulse = useSharedValue(0);
  const handlePress = () => {
    pulse.value = 0;
    pulse.value = withSequence(
      withTiming(0.15, { duration: 0 }),
      withTiming(1, { duration: 650 }, () => {
        pulse.value = 0;
      }),
    );
    if (actionDelay > 0) {
      setTimeout(onPress, actionDelay);
    } else {
      onPress();
    }
  };

  const ringStyle = useAnimatedStyle(() => ({
    opacity: interpolate(pulse.value, [0, 0.15, 1], [0, 1, 0]),
    transform: [{ scale: interpolate(pulse.value, [0, 0.15, 1], [0.95, 1, 1.45]) }],
  }));

  return (
    <View style={styles.loginButtonWrap}>
      <Animated.View
        pointerEvents="none"
        style={[
          styles.loginButtonRing,
          variant === "dark" && styles.loginButtonRingDark,
          ringStyle,
        ]}
      />
      <Pressable
        onPress={handlePress}
        style={({ pressed }) => [
          variant === "lime" ? styles.primaryButton : styles.secondaryButton,
          pressed && styles.loginButtonPressed,
        ]}
      >
        {icon ? (
          <View style={styles.choiceIcon}>
            <Feather name={icon} size={18} color="#18181B" />
          </View>
        ) : null}
        {children}
        <Text style={variant === "lime" ? styles.buttonArrow : styles.buttonArrowDark}>→</Text>
      </Pressable>
    </View>
  );
}
