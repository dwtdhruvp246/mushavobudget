import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("../app.js", import.meta.url), "utf8");

test("personal and family workspaces expose distinct browser routes", () => {
  assert.match(source, /function budgetRouteArea\(\)\s*\{\s*return state\.family \? "family" : "personal";/);
  assert.match(source, /\["family", "personal"\]\.includes\(area\) && familyTabs\.has\(tab\)/);
  assert.match(source, /const routeArea = \["family", "personal"\]\.includes\(area\) \? budgetRouteArea\(\) : area;/);
  assert.match(source, /setRoute\("personal", state\.familyTab, true\);/);
  assert.match(source, /setRoute\("family", state\.familyTab, true\);/);
});

test("new Family-plan checkout no longer hard-codes a Family route on Personal", () => {
  assert.doesNotMatch(source, /window\.location\.hash = "family\/subscription"/);
  assert.match(source, /setRoute\("personal", "subscription", true\);/);
});
