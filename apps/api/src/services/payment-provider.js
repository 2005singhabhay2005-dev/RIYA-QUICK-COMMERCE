
import crypto from "node:crypto";

export function getPaymentProviderConfig() {
  const keyId = process.env.RAZORPAY_KEY_ID || "";
  const keySecret = process.env.RAZORPAY_KEY_SECRET || "";

  return {
    enabled: Boolean(keyId && keySecret),
    keyId
  };
}

export function verifyRazorpayPaymentSignature({
  orderId,
  paymentId,
  signature
}) {
  const secret = process.env.RAZORPAY_KEY_SECRET;

  if (!secret || !orderId || !paymentId || !signature) {
    return false;
  }

  const expected = crypto
    .createHmac("sha256", secret)
    .update(`${orderId}|${paymentId}`)
    .digest("hex");

  const a = Buffer.from(expected);
  const b = Buffer.from(String(signature));

  return (
    a.length === b.length &&
    crypto.timingSafeEqual(a, b)
  );
}

export function assertOnlinePaymentsConfigured() {
  const config = getPaymentProviderConfig();

  if (!config.enabled) {
    const error = new Error(
      "Online payments are not configured. COD remains available."
    );

    error.code = "PAYMENT_PROVIDER_NOT_CONFIGURED";

    throw error;
  }

  return config;
}
