import { toVoiceFormParams } from "../formParams";

describe("toVoiceFormParams", () => {
  it("maps the entry to route params with the group", () => {
    expect(
      toVoiceFormParams(
        { amount: 300000, note: "Ăn tối", categoryId: "c1", payerMemberId: "m1" },
        "Minh trả 300k ăn tối",
        "g1",
      ),
    ).toEqual({
      source: "voice",
      note: "Ăn tối",
      amount: "300000",
      categoryId: "c1",
      payerMemberId: "m1",
      groupId: "g1",
    });
  });
  it("uses the transcript as the note after an AI error with an empty note", () => {
    const p = toVoiceFormParams(
      { amount: null, note: "", categoryId: null, payerMemberId: null, aiError: "ai_unavailable" },
      "ăn tối",
    );
    expect(p).toEqual({ source: "voice", note: "ăn tối", aiError: "ai_unavailable" });
  });
});
