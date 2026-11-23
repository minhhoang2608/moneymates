import { ApiError, type ApiErrorCode } from "../../../api/errors";
import { resolveVoiceEntry, type AiParseResult } from "../resolveVoiceEntry";

const categories = [
  { id: "c-food", name: "Ăn uống", type: "expense" },
  { id: "c-move", name: "Di chuyển", type: "expense" },
  { id: "c-other", name: "Khác", type: "expense" },
];
const members = [
  { id: "m-me", name: "Tôi", isMe: true },
  { id: "m-an", name: "An", isMe: false },
];
const COMPLEX = "hôm qua đi chơi với mấy đứa hết 300k";

const base = { categories, members, aiAvailable: true };

describe("resolveVoiceEntry", () => {
  it("simple sentence stays offline", async () => {
    const parseTextFn = jest.fn();
    const r = await resolveVoiceEntry("ăn phở 50 nghìn", { ...base, parseTextFn });
    expect(r).toMatchObject({ amount: 50000, categoryId: "c-food", note: "phở" });
    expect(parseTextFn).not.toHaveBeenCalled();
  });

  it("uses valid AI fields and ignores invalid ones", async () => {
    const ai: AiParseResult = { amount: 300000, note: "Đi chơi", category: "Không có", payer: "Ai đó" };
    const parseTextFn = jest.fn(async () => ai);
    const r = await resolveVoiceEntry(COMPLEX, { ...base, parseTextFn });
    expect(parseTextFn).toHaveBeenCalledWith(COMPLEX, ["Ăn uống", "Di chuyển", "Khác"], ["Tôi", "An"]);
    expect(r).toMatchObject({ amount: 300000, note: "Đi chơi", categoryId: "c-other", payerMemberId: null });
    expect(r.aiError).toBeUndefined();
    const r2 = await resolveVoiceEntry(COMPLEX, {
      ...base,
      parseTextFn: async () => ({ amount: null, note: null, category: "Di chuyển", payer: "An" }),
    });
    expect(r2).toMatchObject({ categoryId: "c-move", payerMemberId: "m-an" });
  });

  it.each<[string, ApiErrorCode]>([
    ["network", "network"],
    ["timeout", "timeout"],
    ["429", "quota_exceeded"],
    ["403", "ai_disabled"],
    ["502", "ai_unavailable"],
  ])("AI error (%s) keeps offline amount, category Khác, aiError set", async (_n, code) => {
    const r = await resolveVoiceEntry(COMPLEX, {
      ...base,
      parseTextFn: async () => {
        throw new ApiError(code);
      },
    });
    expect(r).toMatchObject({ amount: 300000, categoryId: "c-other", aiError: code });
  });

  it("AI unavailable → no call, offline only, Khác when unsure", async () => {
    const parseTextFn = jest.fn();
    const r = await resolveVoiceEntry(COMPLEX, { ...base, aiAvailable: false, parseTextFn });
    expect(parseTextFn).not.toHaveBeenCalled();
    expect(r).toMatchObject({ amount: 300000, categoryId: "c-other" });
    expect(r.aiError).toBeUndefined();
  });
});
