import { Platform, StyleSheet, useWindowDimensions, View } from "react-native";

const ORBS = [
  { color: "#FFFFFF", size: 118, x: -0.16, y: -0.08 },
  { color: "#FFFFFF", size: 92, x: 0.84, y: 0.12 },
  { color: "#FFFFFF", size: 108, x: -0.12, y: 0.62 },
  { color: "#FFFFFF", size: 84, x: 0.76, y: 0.72 },
  { color: "#FFFFFF", size: 68, x: 0.34, y: 0.9 },
];

export function LoginOrbs() {
  const { width, height } = useWindowDimensions();
  const compact = width < 760;

  return (
    <View pointerEvents="none" style={styles.layer}>
      {ORBS.map((orb, index) => {
        const size = compact ? orb.size : Math.round(orb.size * 1.3);
        return (
          <View
            key={`${orb.color}-${index}`}
            style={[
              styles.orb,
              {
                width: size,
                height: size,
                borderRadius: size / 2,
                backgroundColor: orb.color,
                left: width * orb.x,
                top: height * orb.y,
                shadowColor: orb.color,
                shadowOffset: { width: 0, height: 0 },
                shadowOpacity: 0.9,
                shadowRadius: size / 1.4,
              },
              Platform.OS === "web"
                ? {
                    filter: "blur(40px)",
                    boxShadow: `0 0 ${Math.round(size)}px ${Math.round(size * 0.52)}px ${orb.color}`,
                  }
                : null,
            ]}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  layer: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    overflow: "hidden",
  },
  orb: {
    position: "absolute",
    opacity: 0.24,
  },
});
