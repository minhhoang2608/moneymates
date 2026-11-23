import { clearE2eApiFixtures, registerE2eApiFixture } from "@/e2e/apiAdapter";

import { apiGet, apiPost, apiPostMultipart } from "../client";
import { ApiError } from "../errors";

const original = global.fetch;
let fetchMock: jest.Mock;

beforeEach(() => {
  process.env.EXPO_PUBLIC_E2E = "1";
  fetchMock = jest.fn();
  global.fetch = fetchMock as unknown as typeof fetch;
});
afterEach(() => {
  delete process.env.EXPO_PUBLIC_E2E;
  global.fetch = original;
  clearE2eApiFixtures();
});

describe("E2E api adapter", () => {
  it("AC5: returns registered fixtures without fetch", async () => {
    registerE2eApiFixture("POST /ai/parse-text", { amount: 1 });
    registerE2eApiFixture("POST /ai/parse-bill", { amount: 2 });
    registerE2eApiFixture("GET /me/features", { ai_enabled: true });
    expect(await apiPost("/ai/parse-text", {})).toEqual({ amount: 1 });
    expect(await apiPostMultipart("/ai/parse-bill", new FormData())).toEqual({ amount: 2 });
    expect(await apiGet("/me/features")).toEqual({ ai_enabled: true });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("AC5: unregistered routes reject with ApiError and make no fetch", async () => {
    const err = (await apiPost("/nope", {}).catch((e) => e)) as ApiError;
    expect(err).toBeInstanceOf(ApiError);
    expect(err.code).toBe("network");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("a registered ApiError is thrown", async () => {
    registerE2eApiFixture("POST /ai/parse-text", new ApiError("quota_exceeded", 429));
    expect(((await apiPost("/ai/parse-text", {}).catch((e) => e)) as ApiError).code).toBe("quota_exceeded");
  });
});
