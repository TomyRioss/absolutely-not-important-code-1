const TRIAL_DAYS = 64;

export function getTrialEndsAt(startedAt = new Date()) {
  return new Date(startedAt.getTime() + TRIAL_DAYS * 24 * 60 * 60 * 1000);
}
