
export function getExternalDeliveryConfig() {
  const provider = (
    process.env.EXTERNAL_DELIVERY_PROVIDER || "none"
  ).toLowerCase();

  return {
    provider,
    enabled:
      provider !== "none" &&
      Boolean(process.env.EXTERNAL_DELIVERY_API_KEY)
  };
}

export async function createExternalDeliveryJob(order) {
  const config = getExternalDeliveryConfig();

  if (!config.enabled) {
    const error = new Error(
      "External delivery provider is not configured."
    );

    error.code = "EXTERNAL_DELIVERY_NOT_CONFIGURED";

    throw error;
  }

  throw new Error(
    `Provider "${config.provider}" API adapter is not installed. No fake dispatch was created.`
  );
}
