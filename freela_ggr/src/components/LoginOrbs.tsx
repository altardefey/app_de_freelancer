import { Platform, StyleSheet, useWindowDimensions, View } from "react-native";

const WHITE = "#FFFFFF";

const ORBS = [
  { size: 96, x: -0.12, y: 0.04 },
  { size: 72, x: 0.78, y: 0.22 },
  { size: 84, x: 0.02, y: 0.58 },
  { size: 64, x: 0.76, y: 0.82 },
];

export function LoginOrbs() {
  const { width, height } = useWindowDimensions();
  const compact = width < 760;

  return (
    <View pointerEvents="none" style={styles.layer}>
      {ORBS.map((orb, index) => {
        const size = compact ? orb.size : Math.round(orb.size * 1.25);
        return (
          <View
            key={`orb-${index}`}
            style={[
              styles.orb,
              {
                width: size,
                height: size,
                borderRadius: size / 2,
                backgroundColor: WHITE,
                left: width * orb.x,
                top: height * orb.y,
                shadowColor: WHITE,
                shadowOffset: { width: 0, height: 0 },
                shadowOpacity: 0.55,
                shadowRadius: size / 1.2,
              },
              Platform.OS === "web"
                ? {
                    filter: "blur(36px)",
                    boxShadow: `0 0 ${Math.round(size * 1.1)}px ${Math.round(size * 0.5)}px rgba(255,255,255,0.35)`,
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
    opacity: 0.22,
  },
});
