import { apiGet, apiPost, apiPostMultipart } from "../client";
import { ApiError } from "../errors";
import { clearE2eApiFixtures, registerE2eApiFixture } from "@/e2e/apiAdapter";

const fetchMock = jest.fn();

beforeEach(() => {
  process.env.EXPO_PUBLIC_E2E = "1";
  process.env.EXPO_PUBLIC_API_URL = "https://api.test";
  fetchMock.mockReset();
  global.fetch = fetchMock as unknown as typeof fetch;
  clearE2eApiFixtures();
});
afterEach(() => {
  delete process.env.EXPO_PUBLIC_E2E;
  delete process.env.EXPO_PUBLIC_API_URL;
});

describe("E2E adapter", () => {
  it("AC5: returns fixtures and never calls fetch", async () => {
    registerE2eApiFixture("POST", "/ai/parse-text", { amount: 1 });
    registerE2eApiFixture("POST", "/ai/parse-bill", { amount: 2 });
    registerE2eApiFixture("GET", "/me/features", { ai_enabled: true });
    expect(await apiPost("/ai/parse-text", {})).toEqual({ amount: 1 });
    expect(await apiPostMultipart("/ai/parse-bill", new FormData())).toEqual({ amount: 2 });
    expect(await apiGet("/me/features")).toEqual({ ai_enabled: true });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("fixtures can be ApiErrors", async () => {
    registerE2eApiFixture("POST", "/ai/parse-text", new ApiError("quota_exceeded", 429));
    await expect(apiPost("/ai/parse-text", {})).rejects.toMatchObject({ code: "quota_exceeded" });
  });

  it("AC5: unregistered route rejects without fetch", async () => {
    await expect(apiPost("/nope", {})).rejects.toBeInstanceOf(ApiError);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
