import { isCloud } from "../../utils/is-cloud";

export const aiBillingEnabled = isCloud;

export function marginBps() {
  const value = Number(process.env.KANEO_AI_PRICE_MULTIPLIER_BPS ?? "15000");
  if (!Number.isInteger(value) || value < 10000 || value > 100000)
    throw new Error("Invalid AI price multiplier");
  return value;
}

export const MIN_TOPUP_CENTS = 500;
// Creem's custom_price upper bound for a one-time product.
export const MAX_TOPUP_CENTS = 99_999_999;

export function topupProductId() {
  const productId = process.env.CREEM_PRODUCT_AI_CREDIT?.trim();
  if (!productId) return null;
  const subscriptionProducts = [
    "PERSONAL_MONTHLY",
    "PERSONAL_ANNUAL",
    "TEAM_MONTHLY",
    "TEAM_ANNUAL",
  ].map((key) => process.env[`CREEM_PRODUCT_${key}`]);
  if (subscriptionProducts.includes(productId))
    throw new Error("AI top-ups require a separate one-time product");
  return productId;
}
