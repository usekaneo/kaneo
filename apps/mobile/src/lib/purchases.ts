import { Platform } from "react-native";
import Purchases, {
  PURCHASES_ERROR_CODE,
  type CustomerInfo,
  type PurchasesError,
  type PurchasesPackage,
} from "react-native-purchases";

const SELF_HOSTED_ENTITLEMENT = "self_hosted";

const apiKey = Platform.select({
  ios: process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY,
  android: process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY,
});

let configured = false;

function purchases() {
  if (!configured && apiKey) {
    Purchases.configure({ apiKey });
    configured = true;
  }
  return Purchases;
}

const unlocked = (info: CustomerInfo) =>
  SELF_HOSTED_ENTITLEMENT in info.entitlements.active;

export async function hasSelfHostedUnlock(): Promise<boolean> {
  if (!apiKey) return true;
  return unlocked(await purchases().getCustomerInfo());
}

export async function selfHostedPackage(): Promise<PurchasesPackage | null> {
  const offerings = await purchases().getOfferings();
  return offerings.current?.availablePackages[0] ?? null;
}

export async function buySelfHostedUnlock(
  pkg: PurchasesPackage,
): Promise<boolean> {
  try {
    const { customerInfo } = await purchases().purchasePackage(pkg);
    return unlocked(customerInfo);
  } catch (e) {
    if (
      (e as PurchasesError).code ===
      PURCHASES_ERROR_CODE.PURCHASE_CANCELLED_ERROR
    )
      return false;
    throw e;
  }
}

export async function restoreSelfHostedUnlock(): Promise<boolean> {
  return unlocked(await purchases().restorePurchases());
}
