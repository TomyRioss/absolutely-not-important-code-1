import assert from "node:assert/strict";
import test from "node:test";
import { isActivePlanSubscription } from "../lib/rebill/verified-subscription.mjs";

const configuredPlan = "plan-pro";

test("accepts active subscription from Rebill API result for configured plan", () => {
  assert.equal(
    isActivePlanSubscription({ result: { status: "active", plan: { id: configuredPlan } } }, configuredPlan),
    true,
  );
});

test("rejects inactive subscription even when plan matches", () => {
  assert.equal(
    isActivePlanSubscription({ status: "processing", plan: { id: configuredPlan } }, configuredPlan),
    false,
  );
});

test("rejects active subscription for another plan", () => {
  assert.equal(
    isActivePlanSubscription({ status: "active", plan: { id: "other-plan" } }, configuredPlan),
    false,
  );
});

test("rejects malformed API response", () => {
  assert.equal(isActivePlanSubscription({ status: 1 }, configuredPlan), false);
});
