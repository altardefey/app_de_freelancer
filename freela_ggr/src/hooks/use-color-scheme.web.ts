import { useEffect, useState } from 'react';
import { useColorScheme as useRNColorScheme } from 'react-native';

// no web, espera hidratar antes de confiar no tema do sistema
export function useColorScheme() {
  const [hasHydrated, setHasHydrated] = useState(false);

  useEffect(() => {
    setHasHydrated(true);
  }, []);

  const colorScheme = useRNColorScheme();

  if (hasHydrated) {
    return colorScheme;
  }

  return 'light';
}
