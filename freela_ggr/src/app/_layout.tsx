import { DarkTheme, DefaultTheme, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { Platform, useColorScheme } from 'react-native';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import AppTabs from '@/components/app-tabs';

if (Platform.OS !== 'web') {
  SplashScreen.preventAutoHideAsync();
}

if (Platform.OS === 'web' && typeof window !== 'undefined') {
  window.addEventListener('unhandledrejection', (event) => {
    const message =
      event.reason instanceof Error ? event.reason.message : String(event.reason ?? '');

    if (message.includes('timeout exceeded')) {
      event.preventDefault();
      console.warn('Ignorando timeout de fonte no web:', message);
    }
  });
}

export default function TabLayout() {
  const colorScheme = useColorScheme();
  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <AnimatedSplashOverlay />
      <AppTabs />
    </ThemeProvider>
  );
}
