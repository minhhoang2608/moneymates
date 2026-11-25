import { hasOnboardingOverride } from "../onboardingOverride";

describe("hasOnboardingOverride", () => {
  it("accepts the URLs used by the onboarding Maestro flow", () => {
    expect(hasOnboardingOverride("moneymates:///onboarding?e2e_onboarding=1")).toBe(true);
    expect(hasOnboardingOverride("moneymates:///?e2e_onboarding=1")).toBe(true);
  });

  it("rejects a normal launch", () => {
    expect(hasOnboardingOverride("moneymates:///")).toBe(false);
    expect(hasOnboardingOverride(null)).toBe(false);
  });
});
