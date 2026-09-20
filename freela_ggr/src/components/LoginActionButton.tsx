import { type ReactNode } from "react";
import { BlurView } from "expo-blur";
import { Platform, Pressable, View } from "react-native";
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
          styles.loginLiquidButton,
          variant === "lime" ? styles.loginLiquidButtonLight : styles.loginLiquidButtonDark,
          pressed && styles.loginButtonPressed,
        ]}
      >
        <BlurView
          pointerEvents="none"
          intensity={variant === "lime" ? 58 : 46}
          tint="dark"
          style={styles.loginButtonGlassBlur}
        />
        <View pointerEvents="none" style={styles.loginButtonDepth} />
        <View
          pointerEvents="none"
          style={[
            styles.loginButtonDiagonalGlow,
            Platform.OS === "web"
              ? {
                  backgroundColor: "transparent",
                  backgroundImage:
                    "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.08) 18%, rgba(255,255,255,0.28) 44%, rgba(255,255,255,0.24) 58%, rgba(255,255,255,0.06) 78%, transparent 100%)",
                  filter: "blur(7px)",
                }
              : null,
          ]}
        />
        <View
          pointerEvents="none"
          style={[
            styles.loginButtonDiagonalFeather,
            Platform.OS === "web" ? { filter: "blur(10px)" } : null,
          ]}
        />
        <View pointerEvents="none" style={styles.loginButtonTopGlow} />
        <View pointerEvents="none" style={styles.loginButtonBottomShade} />
        <View pointerEvents="none" style={styles.loginButtonInnerStroke} />
        <View style={styles.loginButtonContent}>
          {icon ? (
            <View style={styles.choiceIcon}>
              <Feather name={icon} size={18} color="#18181B" />
            </View>
          ) : null}
          <View style={styles.loginButtonTextSlot}>{children}</View>
          <View
            style={[
              styles.loginButtonIcon,
              variant === "dark" && styles.loginButtonIconDark,
            ]}
          >
            <Feather
              name="chevron-right"
              size={19}
              color={variant === "dark" ? "#18181B" : "#FFFDF7"}
            />
          </View>
        </View>
      </Pressable>
    </View>
  );
}
