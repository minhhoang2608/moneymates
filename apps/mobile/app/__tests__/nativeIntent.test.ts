import { redirectSystemPath } from "../+native-intent";

describe("redirectSystemPath", () => {
  it("does not route share-intent urls", () => {
    expect(redirectSystemPath({ path: "moneymates://dataUrl=moneymatesShareKey", initial: true })).toBe("/");
  });
  it("passes other paths through", () => {
    expect(redirectSystemPath({ path: "/group/1", initial: false })).toBe("/group/1");
  });
});
