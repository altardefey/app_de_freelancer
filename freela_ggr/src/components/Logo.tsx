import { Text, View } from "react-native";
import { colors, fonts } from "../ui/design";
export function Logo({ light = false }: { light?: boolean }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
      <View
        style={{
          backgroundColor: colors.green,
          width: 32,
          height: 32,
          borderRadius: 10,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Text
          style={{
            fontSize: 27,
            lineHeight: 32,
            fontFamily: fonts.bold,
            color: colors.ink,
          }}
        >
          ƒ
        </Text>
      </View>
      <Text
        style={{
          fontFamily: fonts.bold,
          fontSize: 27,
          letterSpacing: -1.2,
          color: light ? colors.white : colors.ink,
        }}
      >
        freela
      </Text>
    </View>
  );
}
