import AntDesign from '@expo/vector-icons/AntDesign';
import Feather from '@expo/vector-icons/Feather';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useFonts, type FontSource } from 'expo-font';
import type { PropsWithChildren } from 'react';
import { ActivityIndicator, Button, StyleSheet, Text, View } from 'react-native';

// as fontes de ícones não têm as letras usadas no teste padrão do FontFaceObserver
// testa com um símbolo da própria fonte antes de mostrar os ícones
const iconFonts: Record<string, FontSource> = Object.fromEntries(
  [AntDesign, Feather, Ionicons].flatMap((icon) =>
    Object.entries(icon.font).map(([family, uri]) => [
      family,
      { uri, testString: glyphCharacter(Object.values(icon.glyphMap)[0]) },
    ]),
  ),
);

function glyphCharacter(glyph: string | number): string {
  return typeof glyph === 'number' ? String.fromCodePoint(glyph) : glyph;
}

export function IconFontProvider({ children }: PropsWithChildren) {
  const [loaded, error] = useFonts(iconFonts);

  if (error) {
    return (
      <View style={styles.container}>
        <Text accessibilityRole="alert">
          Não foi possível carregar os ícones. Verifique sua conexão e tente novamente.
        </Text>
        <Button title="Tentar novamente" onPress={() => window.location.reload()} />
      </View>
    );
  }

  if (!loaded) {
    return (
      <View style={styles.container}>
        <ActivityIndicator accessibilityLabel="Carregando ícones" />
      </View>
    );
  }

  return children;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 16,
    backgroundColor: '#FFFFFF',
  },
});
