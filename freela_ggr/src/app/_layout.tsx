import { DarkTheme, DefaultTheme, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { Platform, useColorScheme } from 'react-native';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import AppTabs from '@/components/app-tabs';
import { IconFontProvider } from '@/components/icon-font-provider';

if (Platform.OS !== 'web') {
  SplashScreen.preventAutoHideAsync();
}

export default function TabLayout() {
  const colorScheme = useColorScheme();
  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <IconFontProvider>
        <AnimatedSplashOverlay />
        <AppTabs />
      </IconFontProvider>
    </ThemeProvider>
  );
}
