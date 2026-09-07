import {
  crossRate,
  normalizeCurrencyApiPayload,
  safeProviderError,
} from "../_shared/currencyapi.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

Deno.test("normalizes the documented CurrencyAPI latest response", () => {
  const result = normalizeCurrencyApiPayload({
    meta: { last_updated_at: "2026-09-01T00:15:00Z" },
    data: {
      INR: { code: "INR", value: 84 },
      ZAR: { code: "ZAR", value: 18 },
      ZWG: { code: "ZWG", value: 26.5 },
    },
  }, ["USD", "INR", "ZAR", "ZWG"]);
  assert(result.rates.length === 4, "Expected four normalized rates.");
  assert(result.rates.find((rate) => rate.quote_currency === "USD")?.rate === "1", "USD identity rate must be one.");
});

Deno.test("cross-rate direction is base-to-target divided by base-to-source", () => {
  const inrToZar = crossRate(84, 18);
  assert(Math.abs(inrToZar - (18 / 84)) < 1e-12, "Cross-rate direction is incorrect.");
});

Deno.test("redacts API keys and provider URLs from safe errors", () => {
  const safe = safeProviderError(new Error("https://provider.invalid/latest?apikey=EXAMPLE_SECRET_VALUE"));
  assert(!safe.includes("EXAMPLE_SECRET_VALUE"), "Secret was not redacted.");
  assert(!safe.includes("currencyapi.com"), "Provider URL was not redacted.");
});

Deno.test("rejects missing or non-positive provider rates", () => {
  let failed = false;
  try {
    normalizeCurrencyApiPayload({
      meta: { last_updated_at: "2026-09-01T00:15:00Z" },
      data: { INR: { code: "INR", value: 0 } },
    }, ["INR"]);
  } catch {
    failed = true;
  }
  assert(failed, "Invalid provider rate should fail validation.");
});

Deno.test("stores available fiat rates when a newer catalogue code is missing at the provider", () => {
  const result = normalizeCurrencyApiPayload({
    meta: { last_updated_at: "2026-09-05T00:15:00Z" },
    data: {
      XCG: { code: "XCG", value: 1.79 },
    },
  }, ["USD", "XCG", "ZWG"], { allowMissing: true });
  assert(result.rates.length === 2, "USD and XCG should still be stored.");
  assert(result.missingCurrencies.length === 1, "One provider gap should be reported.");
  assert(result.missingCurrencies[0] === "ZWG", "The missing currency must be identified safely.");
});
