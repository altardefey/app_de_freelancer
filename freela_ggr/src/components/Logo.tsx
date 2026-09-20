import { Text, View } from "react-native";

import { styles } from "../screens/HomeScreen.styles";

export function Logo() {
  return (
    <View style={styles.logo}>
      <View style={styles.logoMark}>
        <Text style={styles.logoGlyph}>ƒ</Text>
      </View>
      <Text style={styles.logoText}>freela</Text>
    </View>
  );
}
