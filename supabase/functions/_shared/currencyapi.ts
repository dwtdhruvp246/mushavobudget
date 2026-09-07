export const PROVIDER_NAME = "currencyapi";
export const PROVIDER_BASE_CURRENCY = "USD";
export const RATE_SCALE = 12;

export type CurrencyApiPayload = {
  meta?: { last_updated_at?: unknown };
  data?: Record<string, { code?: unknown; value?: unknown }>;
};

export type NormalizedRate = {
  provider: "currencyapi";
  base_currency: "USD";
  quote_currency: string;
  rate: string;
  provider_effective_at: string;
};

function validCurrencyCode(value: unknown): value is string {
  return typeof value === "string" && /^[A-Z]{3}$/.test(value);
}

function normalizeDecimal(value: number): string {
  if (!Number.isFinite(value) || value <= 0 || value >= 1_000_000_000_000) {
    throw new Error("Provider returned an invalid exchange rate.");
  }
  return value.toFixed(RATE_SCALE).replace(/0+$/, "").replace(/\.$/, "");
}

export function normalizeCurrencyApiPayload(
  payload: CurrencyApiPayload,
  requiredCurrencies: string[],
  options: { allowMissing?: boolean } = {},
): { effectiveAt: string; rates: NormalizedRate[]; missingCurrencies: string[] } {
  const rawTimestamp = payload?.meta?.last_updated_at;
  if (typeof rawTimestamp !== "string") throw new Error("Provider timestamp is missing.");
  const effectiveDate = new Date(rawTimestamp);
  if (Number.isNaN(effectiveDate.getTime())) throw new Error("Provider timestamp is invalid.");
  if (!payload.data || typeof payload.data !== "object") throw new Error("Provider rate data is missing.");

  const required = [...new Set(requiredCurrencies.map((code) => code.trim().toUpperCase()))];
  const rates: NormalizedRate[] = [];
  const missingCurrencies: string[] = [];
  required.forEach((code) => {
    if (!validCurrencyCode(code)) throw new Error("Requested currency code is invalid.");
    if (code === PROVIDER_BASE_CURRENCY) {
      rates.push({
        provider: PROVIDER_NAME,
        base_currency: PROVIDER_BASE_CURRENCY,
        quote_currency: code,
        rate: "1",
        provider_effective_at: effectiveDate.toISOString(),
      });
      return;
    }
    const entry = payload.data?.[code];
    if (!entry || entry.code !== code) {
      if (!options.allowMissing) throw new Error(`Provider rate is missing for ${code}.`);
      missingCurrencies.push(code);
      return;
    }
    const numericValue = typeof entry.value === "number" ? entry.value : Number(entry.value);
    rates.push({
      provider: PROVIDER_NAME,
      base_currency: PROVIDER_BASE_CURRENCY,
      quote_currency: code,
      rate: normalizeDecimal(numericValue),
      provider_effective_at: effectiveDate.toISOString(),
    });
  });

  if (!rates.length) throw new Error("Provider returned no supported fiat exchange rates.");
  return { effectiveAt: effectiveDate.toISOString(), rates, missingCurrencies };
}

export function crossRate(baseToSource: number, baseToTarget: number): number {
  if (![baseToSource, baseToTarget].every((value) => Number.isFinite(value) && value > 0)) {
    throw new Error("Cross-rate inputs must be positive finite numbers.");
  }
  return baseToTarget / baseToSource;
}

export function safeProviderError(error: unknown): string {
  const message = error instanceof Error ? error.message : "Exchange-rate synchronization failed.";
  return message
    .replace(/cur_(?:live|test)_[A-Za-z0-9_-]+/g, "[redacted]")
    .replace(/apikey=[^&\s]+/gi, "apikey=[redacted]")
    .replace(/https?:\/\/[^\s]+/gi, "[provider endpoint redacted]")
    .slice(0, 500);
}
