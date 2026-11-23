import { buildGroupSplitView } from "../groupDetail";

const group = {
  name: "Đà Lạt",
  members: [
    { id: "me", displayName: "Bạn", isMe: true },
    { id: "an", displayName: "An", isMe: false },
  ],
};

describe("buildGroupSplitView", () => {
  it.each([
    ["equal", "Chia đều"],
    ["amount", "Theo số tiền"],
    ["percent", "Theo tỷ lệ"],
  ])("%s mode label", (mode, label) => {
    const v = buildGroupSplitView({ split_mode: mode, paid_by_member_id: "an" }, group, [
      { member_id: "me", amount: 600_000 },
      { member_id: "an", amount: 400_000 },
    ]);
    expect(v.modeLabel).toBe(label);
    expect(v.count).toBe(2);
    expect(v.payerName).toBe("An");
    expect(v.rows).toEqual([
      { memberId: "me", name: "Tôi", amount: 600_000 },
      { memberId: "an", name: "An", amount: 400_000 },
    ]);
  });

  it("labels the is_me payer Tôi and a removed member ?", () => {
    const v = buildGroupSplitView({ split_mode: "equal", paid_by_member_id: "me" }, group, [
      { member_id: "gone", amount: 1 },
    ]);
    expect(v.payerName).toBe("Tôi");
    expect(v.rows[0].name).toBe("?");
  });
});
