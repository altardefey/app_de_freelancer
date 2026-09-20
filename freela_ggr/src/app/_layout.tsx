import { DarkTheme, DefaultTheme, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { Platform, useColorScheme } from 'react-native';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import AppTabs from '@/components/app-tabs';

if (Platform.OS !== 'web') {
  SplashScreen.preventAutoHideAsync();
}

if (Platform.OS === 'web' && typeof window !== 'undefined') {
  const isFontTimeout = (message: string, filename = '') =>
    message.includes('timeout exceeded') || filename.includes('fontfaceobserver');

  window.addEventListener('unhandledrejection', (event) => {
    const message =
      event.reason instanceof Error ? event.reason.message : String(event.reason ?? '');

    if (isFontTimeout(message)) {
      event.preventDefault();
      console.warn('Ignorando timeout de fonte no web:', message);
    }
  });

  window.addEventListener(
    'error',
    (event) => {
      const message = event.message || String(event.error?.message ?? '');
      const filename = event.filename || '';

      if (isFontTimeout(message, filename)) {
        event.preventDefault();
        event.stopImmediatePropagation();
        console.warn('Ignorando timeout de fonte no web:', message);
      }
    },
    true,
  );
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
