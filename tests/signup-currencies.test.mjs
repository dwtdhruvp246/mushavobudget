import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const [signup, styles, migration, diagnostic] = await Promise.all([
  readFile(new URL("../signup.html", import.meta.url), "utf8"),
  readFile(new URL("../styles.css", import.meta.url), "utf8"),
  readFile(new URL("../supabase/migrations/20260905120000_signup_currency_preferences.sql", import.meta.url), "utf8"),
  readFile(new URL("../supabase/signup-currency-diagnostic.sql", import.meta.url), "utf8")
]);

test("signup selects currencies before offering a default", () => {
  assert.ok(signup.indexOf('id="signupCurrencyOptions"') < signup.indexOf('id="signupDefaultCurrency"'));
  assert.match(signup, /id="signupDefaultCurrency" required disabled/);
  assert.match(signup, /const selectedCurrencies = new Set\(\);/);
  assert.match(signup, /let currencyCatalogue = \[\];/);
  assert.doesNotMatch(signup, /new Set\(\["USD"\]\)/);
});

test("the default dropdown contains only selected currencies and requires an explicit choice", () => {
  assert.match(signup, /function renderDefaultCurrencyOptions\(\)/);
  assert.match(signup, /const sorted = \[\.\.\.selectedCurrencies\]\.sort\(\);/);
  assert.match(signup, /"Select your default currency"/);
  assert.match(signup, /defaultCurrencySelect\.disabled = !sorted\.length/);
  assert.match(signup, /!defaultCurrency \|\| !selectedCurrencies\.has\(defaultCurrency\)/);
});

test("signup hides database internals when the public catalogue is unavailable", () => {
  const catalogueFailureHandler = signup.slice(
    signup.indexOf("loadCurrencyCatalogue(supabase).catch"),
    signup.indexOf("defaultCurrencySelect.addEventListener")
  );
  assert.match(signup, /Currency choices are temporarily unavailable/);
  assert.match(catalogueFailureHandler, /showMessage\("Currency choices could not be loaded\. Please try again\."\)/);
  assert.doesNotMatch(catalogueFailureHandler, /showMessage\(error\.message/);
});

test("the compact phone picker retains two currency columns", () => {
  assert.match(styles, /@media \(max-width: 430px\)[\s\S]*?\.signup-currency-section \.currency-option-list\s*\{[\s\S]*?grid-template-columns: repeat\(2, minmax\(0, 1fr\)\);[\s\S]*?max-height: 10\.5rem;/);
  assert.match(styles, /\.signup-currency-step input,[\s\S]*?\.signup-currency-step select\s*\{[\s\S]*?min-height: 42px;/);
});

test("the deployment migration exposes only the safe catalogue and provisions selected currencies", () => {
  assert.match(migration, /create or replace function public\.get_public_signup_currencies\(\)/);
  assert.match(migration, /where currencies\.is_active/);
  assert.match(migration, /grant execute on function public\.get_public_signup_currencies\(\) to anon, authenticated/);
  assert.match(migration, /v_metadata ->> 'default_currency'/);
  assert.match(migration, /v_metadata -> 'enabled_currencies'/);
  assert.match(diagnostic, /has_function_privilege\('anon'/);
  assert.match(diagnostic, /multiple_currency_choices_available/);
});
