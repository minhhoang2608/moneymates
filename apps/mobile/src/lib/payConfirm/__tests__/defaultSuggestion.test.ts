import { suggestDefaultApp } from "../defaultSuggestion";

const base = { order: ["tpb", "tcb", "mb"], recent: [] as string[], accountBins: [] as string[], dismissed: false };

describe("suggestDefaultApp", () => {
  it("suggests an autofill app the user used recently", () => {
    expect(suggestDefaultApp({ ...base, recent: ["tcb", "mb"] })).toBe("mb");
  });
  it("suggests from a receiving account's bank (MB BIN 970422)", () => {
    expect(suggestDefaultApp({ ...base, accountBins: ["970422"] })).toBe("mb");
  });
  it("null when nothing hints at an autofill bank", () => {
    expect(suggestDefaultApp(base)).toBeNull();
  });
  it("null when dismissed", () => {
    expect(suggestDefaultApp({ ...base, recent: ["mb"], dismissed: true })).toBeNull();
  });
  it("null when an autofill app is already first", () => {
    expect(suggestDefaultApp({ ...base, order: ["mb", "tpb"], recent: ["acb"] })).toBeNull();
  });
});
