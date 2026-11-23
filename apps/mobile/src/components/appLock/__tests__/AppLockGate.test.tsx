import { act, fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { useEffect, useState } from "react";
import { AppState, Pressable, Text, View, type AppStateStatus } from "react-native";

import { RepositoriesProvider } from "@/db/RepositoriesProvider";
import { createPreferencesRepository } from "@/db/repositories";
import type { AnyDb } from "@/db/seed";
import { openTestDb } from "@/db/testing/testDb";
import { setAppLockAuth } from "@/lib/appLock/auth";
import { useAppLock } from "@/stores/appLock";
import { AppLockGate } from "../AppLockGate";

let mounts = 0;
function Child() {
  const [n, setN] = useState(0);
  useEffect(() => {
    mounts += 1;
  }, []);
  return (
    <View testID="child">
      <Pressable testID="inc" onPress={() => setN(n + 1)}>
        <Text testID="count">{n}</Text>
      </Pressable>
    </View>
  );
}

let listener: ((s: AppStateStatus) => void) | null = null;
const emit = (s: AppStateStatus) => act(async () => listener?.(s));

async function setup(enabled: boolean, results: boolean[] = [true]) {
  const { db } = openTestDb();
  await createPreferencesRepository(db as unknown as AnyDb).setAppLockEnabled(enabled);
  const authenticate = jest.fn(async () => (results.length > 1 ? results.shift()! : results[0]));
  setAppLockAuth({ isLockAvailable: async () => true, authenticate });
  await render(
    <RepositoriesProvider db={db as unknown as AnyDb}>
      <AppLockGate>
        <Child />
      </AppLockGate>
    </RepositoriesProvider>,
  );
  return authenticate;
}

beforeEach(() => {
  mounts = 0;
  listener = null;
  useAppLock.setState({ status: "loading", prompting: false, enabled: false });
  jest.spyOn(AppState, "addEventListener").mockImplementation(((_t: string, cb: (s: AppStateStatus) => void) => {
    listener = cb;
    return { remove: jest.fn() };
  }) as never);
});
afterEach(() => {
  setAppLockAuth(null);
  jest.restoreAllMocks();
});

describe("AppLockGate", () => {
  it("AC1: disabled -> no prompt, content visible, no lock screen", async () => {
    const authenticate = await setup(false);
    await waitFor(() => expect(screen.queryByTestId("app-lock-screen")).toBeNull());
    expect(screen.getByTestId("child")).toBeVisible();
    expect(authenticate).not.toHaveBeenCalled();
  });

  it("AC2: enabled -> locked, prompts once, unlocks on success", async () => {
    const authenticate = await setup(true);
    await waitFor(() => expect(screen.queryByTestId("app-lock-screen")).toBeNull());
    expect(authenticate).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("child")).toBeVisible();
  });

  it("AC2: failure keeps the lock screen; retry unlocks", async () => {
    const authenticate = await setup(true, [false, true]);
    await waitFor(() => expect(authenticate).toHaveBeenCalledTimes(1));
    expect(screen.getByTestId("app-lock-screen")).toBeTruthy();
    expect(screen.getByTestId("child", { includeHiddenElements: true })).not.toBeVisible();
    await fireEvent.press(screen.getByTestId("app-lock-retry"));
    await waitFor(() => expect(screen.queryByTestId("app-lock-screen")).toBeNull());
    expect(authenticate).toHaveBeenCalledTimes(2);
  });

  it("AC3: background -> active re-locks and prompts again", async () => {
    const authenticate = await setup(true);
    await waitFor(() => expect(screen.queryByTestId("app-lock-screen")).toBeNull());
    await emit("background");
    await emit("active");
    await waitFor(() => expect(authenticate).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.queryByTestId("app-lock-screen")).toBeNull());
  });

  it("AC3: re-lock shows the lock screen when auth fails", async () => {
    const authenticate = await setup(true, [true, false]);
    await waitFor(() => expect(screen.queryByTestId("app-lock-screen")).toBeNull());
    await emit("background");
    await emit("active");
    await waitFor(() => expect(authenticate).toHaveBeenCalledTimes(2));
    expect(screen.getByTestId("app-lock-screen")).toBeTruthy();
  });

  it("AC4: children keep state and are never remounted across lock/unlock", async () => {
    await setup(true);
    await waitFor(() => expect(screen.queryByTestId("app-lock-screen")).toBeNull());
    await fireEvent.press(screen.getByTestId("inc"));
    expect(screen.getByTestId("count").props.children).toBe(1);
    await emit("background");
    await emit("active");
    await waitFor(() => expect(screen.queryByTestId("app-lock-screen")).toBeNull());
    expect(screen.getByTestId("count").props.children).toBe(1);
    expect(mounts).toBe(1);
  });

  it("AC5: inactive -> active (system prompt) does not re-lock or re-prompt", async () => {
    const authenticate = await setup(true);
    await waitFor(() => expect(screen.queryByTestId("app-lock-screen")).toBeNull());
    await emit("inactive");
    await emit("active");
    await emit("active");
    expect(authenticate).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId("app-lock-screen")).toBeNull();
  });

  it("AC5: background/active while a prompt is showing does not prompt again", async () => {
    let resolve!: (v: boolean) => void;
    const { db } = openTestDb();
    await createPreferencesRepository(db as unknown as AnyDb).setAppLockEnabled(true);
    const authenticate = jest.fn(() => new Promise<boolean>((r) => (resolve = r)));
    setAppLockAuth({ isLockAvailable: async () => true, authenticate });
    await render(
      <RepositoriesProvider db={db as unknown as AnyDb}>
        <AppLockGate>
          <Child />
        </AppLockGate>
      </RepositoriesProvider>,
    );
    await waitFor(() => expect(authenticate).toHaveBeenCalledTimes(1));
    await emit("background");
    await emit("active");
    expect(authenticate).toHaveBeenCalledTimes(1);
    await act(async () => resolve(true));
    await waitFor(() => expect(screen.queryByTestId("app-lock-screen")).toBeNull());
  });
});
