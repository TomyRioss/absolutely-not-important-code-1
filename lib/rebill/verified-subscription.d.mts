type Subscription = {
  status?: string;
  plan?: { id?: string };
};

type SubscriptionPayload = Subscription & {
  result?: Subscription;
};

export function isActivePlanSubscription(payload: SubscriptionPayload, expectedPlanId: string): boolean;
export function isPlanActiveStatus(payload: { active?: boolean }): boolean;
