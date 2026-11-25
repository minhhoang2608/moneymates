import { onboardingRedirect } from "../gate";

const base = { loading: false, completed: false, e2e: false, override: false, pathname: "/" };

describe("onboardingRedirect", () => {
  it("waits while loading", () => expect(onboardingRedirect({ ...base, loading: true })).toBeNull());
  it("redirects when not completed", () => expect(onboardingRedirect(base)).toBe("/onboarding"));
  it("does nothing when completed", () => expect(onboardingRedirect({ ...base, completed: true })).toBeNull());
  it("does nothing under /onboarding", () => {
    expect(onboardingRedirect({ ...base, pathname: "/onboarding" })).toBeNull();
    expect(onboardingRedirect({ ...base, pathname: "/onboarding/apps" })).toBeNull();
  });
  it("is skipped in E2E mode", () => expect(onboardingRedirect({ ...base, e2e: true })).toBeNull());
  it("E2E override turns it back on", () =>
    expect(onboardingRedirect({ ...base, e2e: true, override: true })).toBe("/onboarding"));
});
