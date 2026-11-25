export type OnboardingGateInput = {
  loading: boolean;
  completed: boolean;
  e2e: boolean;
  /** E2E launch override: show onboarding even in E2E mode. */
  override: boolean;
  pathname: string;
};

/** Where the first-launch gate sends the user, or null to leave navigation alone. */
export function onboardingRedirect({
  loading,
  completed,
  e2e,
  override,
  pathname,
}: OnboardingGateInput): "/onboarding" | null {
  if (loading || completed) return null;
  if (e2e && !override) return null;
  if (pathname === "/onboarding" || pathname.startsWith("/onboarding/")) return null;
  // Opened from onboarding step 3 ("Thông báo ngân hàng"); redirecting would throw the user back to step 1.
  if (pathname === "/notif-access") return null;
  return "/onboarding";
}
