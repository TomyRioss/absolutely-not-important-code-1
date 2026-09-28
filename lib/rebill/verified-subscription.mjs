export function isActivePlanSubscription(payload, expectedPlanId) {
  const subscription = payload?.result ?? payload;
  return Boolean(
    expectedPlanId &&
      typeof subscription?.status === "string" &&
      subscription.status.toLowerCase() === "active" &&
      subscription?.plan?.id === expectedPlanId,
  );
}
