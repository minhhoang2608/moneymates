import { setApiAdapter } from "../adapter";
import { parseBill } from "../parseBill";

afterEach(() => setApiAdapter(null));

function adapterReturning(value: unknown) {
  const postMultipart = jest.fn(async () => value);
  setApiAdapter({ get: jest.fn(), post: jest.fn(), postMultipart } as never);
  return postMultipart;
}

describe("parseBill", () => {
  it("AC5: posts image and categories to /ai/parse-bill", async () => {
    const spy = adapterReturning({
      amount: 345000,
      currency: "VND",
      shop: "Quán",
      date: "2026-11-22",
      category: "Ăn uống",
    });
    const append = jest.spyOn(FormData.prototype, "append");
    const res = await parseBill("file:///b.jpg", ["Ăn uống", "Khác"]);
    const [path, form] = spy.mock.calls[0] as unknown as [string, FormData];
    expect(path).toBe("/ai/parse-bill");
    expect(form.get("categories")).toBe(JSON.stringify(["Ăn uống", "Khác"]));
    expect(form).toBeInstanceOf(FormData);
    expect(append).toHaveBeenCalledWith("image", { uri: "file:///b.jpg", name: "bill.jpg", type: "image/jpeg" });
    append.mockRestore();
    expect(res).toEqual({ amount: 345000, currency: "VND", shop: "Quán", date: "2026-11-22", category: "Ăn uống" });
  });
  it("normalises bad fields to null", async () => {
    adapterReturning({ amount: 12.5, currency: "VND", shop: " ", date: null, category: "Lạ" });
    expect(await parseBill("u", ["Khác"])).toEqual({
      amount: null,
      currency: "VND",
      shop: null,
      date: null,
      category: null,
    });
  });
});
