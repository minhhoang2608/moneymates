import { File } from "expo-file-system";
import { convertFormDataAsync } from "expo/build/winter/fetch/convertFormData";

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
    expect(append).toHaveBeenCalledWith("image", expect.any(File));
    append.mockRestore();
    expect(res).toEqual({ amount: 345000, currency: "VND", shop: "Quán", date: "2026-11-22", category: "Ăn uống" });
  });
  it("sends the image as a part Expo's fetch can encode (not a { uri } object)", async () => {
    // The jest File mock has no body; give it the one method Expo's multipart encoder reads.
    const proto = File.prototype as unknown as { bytes?: () => Promise<Uint8Array>; name?: string; type?: string };
    Object.assign(proto, { bytes: async () => new Uint8Array([1, 2, 3]), name: "bill.jpg", type: "image/jpeg" });
    const append = jest.spyOn(FormData.prototype, "append");
    const spy = adapterReturning({ amount: 1, currency: "VND", shop: null, date: null, category: null });
    await parseBill("file:///b.jpg", ["Khác"]);
    const [, form] = spy.mock.calls[0] as unknown as [string, FormData];
    // Expo's fetch encodes the parts it finds in form.entries(); feed it exactly what parseBill appended.
    const parts = append.mock.calls.map((c) => [c[0], c[1]]);
    append.mockRestore();
    (form as unknown as { entries: () => unknown }).entries = () => parts;
    const { body } = await convertFormDataAsync(form, "BOUNDARY");
    const text = Buffer.from(body).toString("latin1");
    expect(text).toContain('name="image"; filename="bill.jpg"');
    expect(text).toContain("content-type: image/jpeg");
    expect(text).not.toContain("[object Object]");
    expect(text).toContain('name="categories"');
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
