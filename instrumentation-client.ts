import posthog from "posthog-js";

const token = process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN;
const isLocalhost = /^(localhost|127\.0\.0\.1)$/.test(window.location.hostname);

if (isLocalhost) {
  // ponytail: skip init entirely so no events/session recordings leak from local dev
} else if (!token) {
  if (process.env.NODE_ENV !== "production") {
    console.error(
      "NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN variable required by PostHog is missing or un-configured, this causes events to be silently missed. This error stops appearing once NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN is configured"
    );
  }
} else {
  posthog.init(token, {
    api_host: "/ingest",
    ui_host: "https://us.posthog.com",
    defaults: "2026-01-30",
    capture_pageview: false,
    capture_exceptions: true,
    debug: process.env.NODE_ENV === "development",
  });
}

export { posthog };
