import { Pressable, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Animated, {
  Easing,
  FadeIn,
  FadeOut,
  LinearTransition,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";

type CheckboxProps = {
  label: string;
  checked: boolean;
  onPress: () => void;
  activeColor?: string;
  inactiveColor?: string;
};

const Layout = LinearTransition.springify().mass(1).damping(30).stiffness(250);
const LayoutEntering = FadeIn.duration(150).easing(
  Easing.bezier(0.895, 0.03, 0.685, 0.22).factory(),
);
const LayoutExiting = FadeOut.duration(150).easing(
  Easing.bezier(0.895, 0.03, 0.685, 0.22).factory(),
);

function fadeHex(hex: string, alpha: number) {
  const value = hex.replace("#", "");
  const red = parseInt(value.slice(0, 2), 16);
  const green = parseInt(value.slice(2, 4), 16);
  const blue = parseInt(value.slice(4, 6), 16);
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}

export function AnimatedCheckbox({
  label,
  checked,
  onPress,
  activeColor = "#CCFF00",
  inactiveColor = "#B3B1B4",
}: CheckboxProps) {
  const scale = useSharedValue(1);
  const fadedActiveColor = fadeHex(activeColor, 0.12);
  const fadedInactiveColor = fadeHex(inactiveColor, 0.12);

  const containerStyle = useAnimatedStyle(() => ({
    paddingRight: checked ? 14 : 24,
    borderColor: checked ? fadedActiveColor : fadedInactiveColor,
    backgroundColor: checked ? fadedActiveColor : "transparent",
    transform: [{ scale: scale.value }],
  }));

  const textStyle = useAnimatedStyle(() => ({
    color: checked ? activeColor : inactiveColor,
  }));

  return (
    <Animated.View layout={Layout}>
      <Pressable
        onPress={onPress}
        onPressIn={() => {
          scale.value = withSpring(0.96, { damping: 18, stiffness: 280 });
        }}
        onPressOut={() => {
          scale.value = withSpring(1, { damping: 18, stiffness: 280 });
        }}
      >
        <Animated.View style={[styles.container, containerStyle]}>
          <Animated.Text style={[styles.label, textStyle]}>{label}</Animated.Text>
          {checked ? (
            <Animated.View
              style={styles.checkWrap}
              layout={Layout}
              entering={LayoutEntering}
              exiting={LayoutExiting}
            >
              <Ionicons name="checkmark-circle" size={20} color={activeColor} />
            </Animated.View>
          ) : null}
        </Animated.View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    borderCurve: "continuous",
    borderRadius: 36,
    borderWidth: 1.5,
    flexDirection: "row",
    justifyContent: "center",
    paddingLeft: 18,
    paddingVertical: 10,
  },
  label: {
    fontSize: 14,
    fontWeight: "700",
  },
  checkWrap: {
    marginLeft: 10,
  },
});
