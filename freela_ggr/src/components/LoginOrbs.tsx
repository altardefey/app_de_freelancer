import { Platform, StyleSheet, useWindowDimensions, View } from "react-native";

const ORBS = [
  { color: "#4ADE80", size: 88, x: -0.08, y: 0.04 },
  { color: "#38BDF8", size: 72, x: 0.82, y: 0.08 },
  { color: "#FB923C", size: 64, x: 0.18, y: 0.22 },
  { color: "#CCFF00", size: 58, x: 0.72, y: 0.36 },
  { color: "#A78BFA", size: 80, x: -0.1, y: 0.46 },
  { color: "#F472B6", size: 52, x: 0.58, y: 0.56 },
  { color: "#38BDF8", size: 68, x: 0.28, y: 0.74 },
  { color: "#4ADE80", size: 62, x: 0.86, y: 0.84 },
  { color: "#FB923C", size: 48, x: -0.04, y: 0.68 },
  { color: "#CCFF00", size: 56, x: 0.5, y: 0.9 },
  { color: "#38BDF8", size: 44, x: 0.42, y: 0.14 },
  { color: "#A78BFA", size: 50, x: 0.08, y: 0.92 },
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
                    filter: "blur(32px)",
                    boxShadow: `0 0 ${Math.round(size * 0.9)}px ${Math.round(size * 0.45)}px ${orb.color}`,
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
    opacity: 0.45,
  },
});
