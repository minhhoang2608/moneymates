import { render, screen, waitFor } from "@testing-library/react-native";
import { AccessibilityInfo } from "react-native";

import GroupsScreen from "../(tabs)/groups";
import HistoryScreen from "../(tabs)/history";
import OverviewScreen from "../(tabs)/index";

// Direct renders with deferred repositories, to observe the loading state before the data arrives.
const mockRepos: { current: Record<string, unknown> } = { current: {} };
jest.mock("expo-router", () => ({
  useRouter: () => ({ push: jest.fn() }),
  useFocusEffect: (cb: () => void | (() => void)) => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    require("react").useEffect(cb, [cb]);
  },
}));
jest.mock("@/components/EntryMenu", () => ({ EntryMenu: () => null }));
jest.mock("@/components/EntryButtons", () => ({ EntryButtons: () => null }));
jest.mock("@/db/RepositoriesProvider", () => ({ useRepositories: () => mockRepos.current }));

function deferred<T>() {
  let resolve!: (v: T) => void;
  const promise = new Promise<T>((r) => (resolve = r));
  return { promise, resolve };
}

const txn = (id: string) => ({
  id,
  type: "expense",
  amount: 50_000,
  currency: "VND",
  occurred_at: "2026-11-22T03:00:00Z",
  note: `note-${id}`,
  category_id: "c1",
  group_id: null,
  money_source: "Tiền mặt",
  source: "manual",
  deleted_at: null,
});

beforeEach(() => {
  jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(false);
});
afterEach(() => jest.restoreAllMocks());

describe("history", () => {
  const setup = (rows: ReturnType<typeof txn>[]) => {
    const list = deferred<unknown[]>();
    const softDelete = jest.fn(async () => {});
    mockRepos.current = {
      transactions: { listWithReceiptFlag: () => list.promise, softDelete },
      categories: { listByKind: async () => [{ id: "c1", name: "Ăn uống" }] },
      groups: { listGroups: async () => [] },
    };
    return { release: () => list.resolve(rows), softDelete };
  };

  it("AC2: shows a skeleton first, then the rows", async () => {
    const { release } = setup([txn("a"), txn("b")]);
    await render(<HistoryScreen />);
    expect(screen.getByTestId("history-skeleton")).toBeTruthy();
    expect(screen.queryByTestId("history-row-anim-a")).toBeNull();
    release();
    await screen.findByTestId("history-row-anim-a");
    expect(screen.queryByTestId("history-skeleton")).toBeNull();
    expect(screen.getByTestId("history-row-anim-b")).toBeTruthy();
  });

  it("AC1: rows carry entering, exiting and layout animations", async () => {
    const { release } = setup([txn("a")]);
    await render(<HistoryScreen />);
    release();
    const row = await screen.findByTestId("history-row-anim-a");
    expect(row.props.entering).toBeDefined();
    expect(row.props.exiting).toBeDefined();
    expect(row.props.layout).toBeDefined();
  });

  it("AC4: no animations with reduce motion", async () => {
    jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(true);
    const { release } = setup([txn("a")]);
    await render(<HistoryScreen />);
    release();
    await screen.findByTestId("history-row-anim-a");
    await waitFor(() => expect(screen.getByTestId("history-row-anim-a").props.entering).toBeUndefined());
    const row = screen.getByTestId("history-row-anim-a");
    expect(row.props.exiting).toBeUndefined();
    expect(row.props.layout).toBeUndefined();
  });
});

describe("overview", () => {
  const data = {
    month: "2026-11",
    overview: {
      expenseTotal: 200_000,
      incomeTotal: 0,
      lastExpenseTotal: 100_000,
      myShareTotal: 0,
      alert: "up",
      percent: 100,
      top: [{ category: "Ăn uống", amount: 200_000 }],
    },
    recent: [txn("a")],
    categoryNames: { c1: "Ăn uống" },
    hasAny: true,
  };

  const setup = () => {
    const d = deferred<unknown>();
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    jest.spyOn(require("@/lib/stats/loadOverview"), "loadOverview").mockReturnValue(d.promise);
    mockRepos.current = {
      profile: { getProfile: async () => ({ display_name: "Hoàng" }) },
      preferences: { getAlertOverLastMonth: async () => true },
      groupExpenses: { mySharesInMonth: jest.fn() },
    };
    return d;
  };

  it("AC2: shows a skeleton, keeps the add button, then the data", async () => {
    const d = setup();
    await render(<OverviewScreen />);
    expect(screen.getByTestId("overview-skeleton")).toBeTruthy();
    expect(screen.getByTestId("overview-add-button")).toBeTruthy();
    expect(screen.queryByTestId("overview-expense")).toBeNull();
    d.resolve(data);
    await screen.findByTestId("overview-expense");
    expect(screen.queryByTestId("overview-skeleton")).toBeNull();
  });

  it("AC3: cards and the banner fade in", async () => {
    const d = setup();
    await render(<OverviewScreen />);
    d.resolve(data);
    await screen.findByTestId("overview-expense");
    for (const id of ["overview-hero", "overview-banner", "overview-top", "overview-recent"]) {
      expect(screen.getByTestId(id).props.entering).toBeDefined();
    }
  });

  it("AC4: no fade with reduce motion", async () => {
    jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(true);
    const d = setup();
    await render(<OverviewScreen />);
    d.resolve(data);
    await screen.findByTestId("overview-expense");
    await waitFor(() => expect(screen.getByTestId("overview-hero").props.entering).toBeUndefined());
    expect(screen.getByTestId("overview-banner").props.entering).toBeUndefined();
  });
});

describe("groups", () => {
  it("AC2: shows a skeleton first, then the cards", async () => {
    const d = deferred<unknown[]>();
    mockRepos.current = { groups: { listGroups: () => d.promise } };
    await render(<GroupsScreen />);
    expect(screen.getByTestId("groups-skeleton")).toBeTruthy();
    d.resolve([
      {
        id: "g1",
        name: "Đà Lạt",
        icon: "trip",
        start_date: null,
        end_date: null,
        total: 0,
        members: [{ id: "m1", displayName: "Tôi", isMe: true }],
      },
    ]);
    await screen.findByTestId("group-card-g1");
    expect(screen.queryByTestId("groups-skeleton")).toBeNull();
  });
});
