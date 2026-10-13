import { Platform } from "react-native";
import Constants from "expo-constants";
import type { PurchasesPackage } from "react-native-purchases";

export const REVENUECAT_ENTITLEMENT = "freela";
const apiKey =
  Platform.OS === "ios"
    ? process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY
    : process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY;
export const isTestStore = !!apiKey?.startsWith("test_");
export const billingAvailable =
  (Platform.OS === "ios" || Platform.OS === "android") &&
  Constants.executionEnvironment !== "storeClient" &&
  !!apiKey &&
  (!isTestStore || __DEV__);
let currentUser: string | null = null;
let configuration: Promise<void> | null = null;

export async function billing(userId: string) {
  if (!billingAvailable)
    throw new Error(
      "As assinaturas estarão disponíveis no aplicativo para Android e iOS.",
    );
  const { default: Purchases, LOG_LEVEL } =
    await import("react-native-purchases");
  // evita configurar o sdk duas vezes quando mais de uma tela consulta a oferta
  const previous = configuration ?? Promise.resolve();
  configuration = previous
    .catch(() => {})
    .then(async () => {
      if (!currentUser) {
        Purchases.setLogLevel(__DEV__ ? LOG_LEVEL.VERBOSE : LOG_LEVEL.WARN);
        Purchases.configure({
          apiKey: apiKey!,
          appUserID: userId,
        });
      } else if (currentUser !== userId) {
        await Purchases.logIn(userId);
      }
      currentUser = userId;
    });
  await configuration;
  return Purchases;
}
export async function monthlyPackage(
  userId: string,
): Promise<PurchasesPackage | null> {
  const purchases = await billing(userId);
  return (await purchases.getOfferings()).current?.monthly ?? null;
}

// o servidor confirma a assinatura antes de liberar os orçamentos sem limite
export async function presentFreelaPaywall(userId: string) {
  const purchases = await billing(userId);
  const existing = await purchases.getCustomerInfo();
  if (existing.entitlements.active[REVENUECAT_ENTITLEMENT]) return existing;
  const { default: RevenueCatUI, PAYWALL_RESULT } =
    await import("react-native-purchases-ui");
  const result = await RevenueCatUI.presentPaywall();
  switch (result) {
    case PAYWALL_RESULT.PURCHASED:
    case PAYWALL_RESULT.RESTORED:
      return purchases.getCustomerInfo();
    case PAYWALL_RESULT.CANCELLED:
    case PAYWALL_RESULT.NOT_PRESENTED:
      return null;
    case PAYWALL_RESULT.ERROR:
      throw new Error("Não foi possível abrir a oferta. Tente novamente.");
    default:
      return null;
  }
}
