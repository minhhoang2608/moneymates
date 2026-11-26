import { act, fireEvent, screen, waitFor } from "@testing-library/react-native";

import { TransactionForm } from "../TransactionForm";
import { createGroupExpenseRepository, createGroupRepository, createMoneySourceRepository } from "@/db/repositories";
import type { AnyDb } from "@/db/seed";
import { catId, setup } from "@/testing/repoTestUtils";

// The first render cold-loads the form tree; the default 5s is too tight on loaded CI runners.
jest.setTimeout(20000);

const NOW = new Date(2026, 10, 23, 14, 20);

beforeEach(() => {
  jest.useFakeTimers({ now: NOW, doNotFake: ["nextTick", "setImmediate", "queueMicrotask"] });
});
afterEach(() => jest.useRealTimers());

const noPhoto = { pick: jest.fn(async () => null) };

function form(props: Partial<React.ComponentProps<typeof TransactionForm>> = {}) {
  const onClose = jest.fn();
  const s = setup(() => <TransactionForm onClose={onClose} photoPicker={noPhoto} {...props} />);
  return { ...s, onClose };
}

async function chooseCategory(id: string) {
  await fireEvent.press(screen.getByTestId("category-row"));
  await fireEvent.press(await screen.findByTestId(`category-item-${id}`));
}

describe("TransactionForm money sources", () => {
  it("AC2/AC5: a source added in Settings can be picked and is saved as VND", async () => {
    const { db, repos, mount, onClose } = form();
    await createMoneySourceRepository(db).addSource("Visa", "card");
    await mount();
    await fireEvent.changeText(screen.getByTestId("amount-input"), "50k");
    await chooseCategory(catId("Ăn uống"));
    await fireEvent.press(screen.getByTestId("money-source-row"));
    await fireEvent.press(await screen.findByText("Visa"));
    await fireEvent.press(screen.getByTestId("save-button"));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    const rows = await repos.transactions.list();
    expect(rows[0]).toMatchObject({ money_source: "Visa", currency: "VND" });
  });

  it("AC2: a deleted source is not offered any more", async () => {
    const { db, mount } = form();
    const sources = createMoneySourceRepository(db);
    const visa = await sources.addSource("Visa", "card");
    await sources.deleteSource(visa.id);
    await mount();
    await fireEvent.press(screen.getByTestId("money-source-row"));
    await screen.findByText("Ví điện tử");
    expect(screen.queryByText("Visa")).toBeNull();
  });

  it("AC3: editing a transaction keeps its deleted source selected", async () => {
    const { db, repos, mount } = form();
    const sources = createMoneySourceRepository(db);
    const visa = await sources.addSource("Visa", "card");
    const t = await repos.transactions.create({
      type: "expense",
      amount: 1000,
      occurred_at: NOW.toISOString(),
      note: "",
      category_id: catId("Ăn uống"),
      money_source: "Visa",
    });
    await sources.deleteSource(visa.id);
    await mount(<TransactionForm transactionId={t.id} onClose={jest.fn()} photoPicker={noPhoto} />);
    expect(await screen.findByText("Visa ›")).toBeTruthy();
    await fireEvent.press(screen.getByTestId("money-source-row"));
    expect(await screen.findAllByText("Visa")).toBeTruthy();
  });
});

describe("TransactionForm", () => {
  it("AC1: has no old disabled Nhập tay / Voice / Ảnh bill row", async () => {
    const { mount } = form();
    await mount();
    expect(screen.queryByText("Ảnh bill")).toBeNull();
    expect(screen.queryByText("Nhập tay")).toBeNull();
    expect(screen.queryByText("Voice")).toBeNull();
  });

  it("AC1: saves 50k Ăn uống phở as an expense", async () => {
    const { repos, mount, onClose } = form();
    await mount();
    await fireEvent.changeText(screen.getByTestId("amount-input"), "50k");
    await chooseCategory(catId("Ăn uống"));
    await fireEvent.changeText(screen.getByTestId("note-input"), "phở");
    await fireEvent.press(screen.getByTestId("save-button"));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    const rows = await repos.transactions.list();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      amount: 50000,
      type: "expense",
      category_id: catId("Ăn uống"),
      note: "phở",
      source: "manual",
      currency: "VND",
      occurred_at: NOW.toISOString(),
    });
  });

  it.each([
    ["1tr2", "= 1.200.000đ"],
    ["1.5tr", "= 1.500.000đ"],
    ["50.000", "= 50.000đ"],
  ])("AC2: previews %s", async (text, preview) => {
    const { mount } = form();
    await mount();
    await fireEvent.changeText(screen.getByTestId("amount-input"), text);
    expect(screen.getByTestId("amount-preview").props.children).toContain(preview);
  });

  it.each(["", "0", "abc"])("AC3: rejects amount %p without saving", async (text) => {
    const { repos, mount, onClose } = form();
    await mount();
    await fireEvent.changeText(screen.getByTestId("amount-input"), text);
    await chooseCategory(catId("Ăn uống"));
    await fireEvent.press(screen.getByTestId("save-button"));
    expect(await screen.findByTestId("amount-error")).toBeTruthy();
    expect(await repos.transactions.list()).toHaveLength(0);
    expect(onClose).not.toHaveBeenCalled();
  });

  it("requires a category", async () => {
    const { repos, mount } = form();
    await mount();
    await fireEvent.changeText(screen.getByTestId("amount-input"), "50k");
    await fireEvent.press(screen.getByTestId("save-button"));
    expect(await screen.findByText("Chọn danh mục ›")).toBeTruthy();
    expect(await repos.transactions.list()).toHaveLength(0);
  });

  it("AC4: Thu lists only income categories and saves income", async () => {
    const { repos, mount, onClose } = form();
    await mount();
    await fireEvent.press(screen.getByTestId("type-income"));
    await fireEvent.press(screen.getByTestId("category-row"));
    await screen.findByTestId(`category-item-${catId("Lương", "income")}`);
    expect(screen.queryByText("Ăn uống")).toBeNull();
    await fireEvent.press(screen.getByTestId(`category-item-${catId("Lương", "income")}`));
    await fireEvent.changeText(screen.getByTestId("amount-input"), "25tr");
    await fireEvent.press(screen.getByTestId("save-button"));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect((await repos.transactions.list())[0]).toMatchObject({ type: "income", amount: 25000000 });
  });

  it("resets the category when the type changes", async () => {
    const { mount } = form();
    await mount();
    await chooseCategory(catId("Ăn uống"));
    expect(await screen.findByText("Ăn uống ›")).toBeTruthy();
    await fireEvent.press(screen.getByTestId("type-income"));
    expect(screen.getByText("Chọn danh mục ›")).toBeTruthy();
  });

  it("AC5: stores time, money source and photo, and shows them when reopened", async () => {
    const picker = { pick: jest.fn(async () => "file:///doc/p.jpg") };
    const { repos, mount, onClose } = form({ photoPicker: picker });
    await mount();
    await fireEvent.changeText(screen.getByTestId("amount-input"), "50k");
    await chooseCategory(catId("Ăn uống"));

    await fireEvent.press(screen.getByTestId("datetime-row"));
    const yesterday = new Date(2026, 10, 22, 19, 30);
    await fireEvent(screen.getByTestId("datetime-picker"), "onChange", { type: "set" }, yesterday);
    await fireEvent(screen.getByTestId("datetime-picker"), "onChange", { type: "set" }, yesterday);
    expect(await screen.findByText("Hôm qua, 19:30 ›")).toBeTruthy();

    await fireEvent.press(screen.getByTestId("money-source-row"));
    await fireEvent.press(await screen.findByTestId("money-source-item-0"));
    await act(async () => await fireEvent.press(screen.getByTestId("photo-row")));
    await fireEvent.press(screen.getByTestId("save-button"));
    await waitFor(() => expect(onClose).toHaveBeenCalled());

    const [row] = await repos.transactions.list();
    expect(row).toMatchObject({
      money_source: "Tiền mặt",
      photo_uri: "file:///doc/p.jpg",
      occurred_at: yesterday.toISOString(),
    });

    await screen.unmount();
    await mount(<TransactionForm transactionId={row.id} onClose={jest.fn()} photoPicker={noPhoto} />);
    expect(await screen.findByText("Hôm qua, 19:30 ›")).toBeTruthy();
    expect(screen.getByText("Tiền mặt ›")).toBeTruthy();
    const thumb = screen.getByTestId("photo-thumbnail");
    expect(thumb.props.accessible).not.toBe(false);
    expect(screen.getByTestId("photo-thumbnail-image").props.source).toEqual({ uri: "file:///doc/p.jpg" });
    // Must not be nested in the accessible photo-row, or Android hides its id from Maestro.
    for (let n = thumb.parent; n; n = n.parent) expect(n.props.testID).not.toBe("photo-row");
  });

  it("edit mode prefills and updates instead of creating", async () => {
    const { repos, mount, onClose } = form({ transactionId: "x" });
    const created = await repos.transactions.create({
      type: "expense",
      amount: 30000,
      category_id: catId("Di chuyển"),
      note: "grab",
      occurred_at: NOW.toISOString(),
    });
    await mount(<TransactionForm transactionId={created.id} onClose={onClose} photoPicker={noPhoto} />);
    expect(await screen.findByText("Sửa giao dịch")).toBeTruthy();
    expect(screen.getByTestId("amount-input").props.value).toBe("30000");
    expect(screen.getByText("Di chuyển ›")).toBeTruthy();
    await fireEvent.changeText(screen.getByTestId("amount-input"), "45k");
    await fireEvent.press(screen.getByTestId("save-button"));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    const rows = await repos.transactions.list();
    expect(rows).toHaveLength(1);
    expect(rows[0].amount).toBe(45000);
  });

  describe("group expense edit", () => {
    async function seed(
      db: unknown,
      splitMode: "equal" | "amount",
      onClose: () => void,
      mount: (el: React.ReactElement) => Promise<unknown>,
    ) {
      const a = db as AnyDb;
      const g = await createGroupRepository(a).createGroup({ name: "Đà Lạt", members: ["An", "Bình"] });
      const ids = g.members.map((m) => m.id);
      const exp = createGroupExpenseRepository(a);
      const t = await exp.createGroupExpense({
        groupId: g.id,
        amount: 1_000_000,
        payerMemberId: ids[1],
        splitMode,
        shares:
          splitMode === "equal"
            ? ids.map((memberId) => ({ memberId }))
            : [
                { memberId: ids[0], amount: 400_000 },
                { memberId: ids[1], amount: 300_000 },
                { memberId: ids[2], amount: 300_000 },
              ],
        occurredAt: NOW.toISOString(),
      });
      await mount(<TransactionForm transactionId={t.id} onClose={onClose} photoPicker={noPhoto} />);
      return { exp, t, g };
    }

    it("AC2: equal split recomputes shares and group total", async () => {
      const { db, mount, onClose } = form({ transactionId: "x" });
      const { exp, t, g } = await seed(db, "equal", onClose, mount);
      await screen.findByText("Sửa giao dịch");
      await fireEvent.changeText(screen.getByTestId("amount-input"), "900000");
      await fireEvent.press(screen.getByTestId("save-button"));
      await waitFor(() => expect(onClose).toHaveBeenCalled());
      expect((await exp.getShares(t.id)).map((x) => x.amount)).toEqual([300_000, 300_000, 300_000]);
      expect(await exp.groupTotal(g.id)).toBe(900_000);
    });

    it("amount-mode split with a changed amount shows an error and blocks the save", async () => {
      const { db, mount, onClose } = form({ transactionId: "x" });
      const { exp, t } = await seed(db, "amount", onClose, mount);
      await screen.findByText("Sửa giao dịch");
      await fireEvent.changeText(screen.getByTestId("amount-input"), "900000");
      await fireEvent.press(screen.getByTestId("save-button"));
      expect(await screen.findByTestId("split-error")).toBeTruthy();
      expect(onClose).not.toHaveBeenCalled();
      expect((await exp.getShares(t.id)).map((x) => x.amount)).toEqual([400_000, 300_000, 300_000]);
    });
  });
});

describe("TransactionForm haptics", () => {
  const Haptics = jest.requireMock("expo-haptics");
  const { setHapticsEnabled } = jest.requireActual("@/lib/haptics");
  beforeEach(() => {
    jest.clearAllMocks();
    setHapticsEnabled(true);
  });
  afterEach(() => setHapticsEnabled(true));

  it("AC1: a valid save fires one light impact and no error haptic", async () => {
    const { mount, onClose } = form();
    await mount();
    await fireEvent.changeText(screen.getByTestId("amount-input"), "50k");
    await chooseCategory(catId("Ăn uống"));
    await fireEvent.press(screen.getByTestId("save-button"));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(Haptics.impactAsync).toHaveBeenCalledTimes(1);
    expect(Haptics.impactAsync).toHaveBeenCalledWith("light");
    expect(Haptics.notificationAsync).not.toHaveBeenCalled();
  });

  it("AC3: an invalid save fires the error haptic", async () => {
    const { mount } = form();
    await mount();
    await fireEvent.press(screen.getByTestId("save-button"));
    expect(Haptics.notificationAsync).toHaveBeenCalledTimes(1);
    expect(Haptics.impactAsync).not.toHaveBeenCalled();
  });

  it("AC4: nothing fires when haptics are disabled", async () => {
    setHapticsEnabled(false);
    const { mount } = form();
    await mount();
    await fireEvent.press(screen.getByTestId("save-button"));
    expect(Haptics.notificationAsync).not.toHaveBeenCalled();
    expect(Haptics.impactAsync).not.toHaveBeenCalled();
  });
});

describe("TransactionForm category from the note", () => {
  const categoryRow = () => screen.getByTestId("category-row");

  it("voice with 'đi grab hết' and no category selects Di chuyển", async () => {
    const { mount } = form({
      source: "voice",
      initial: { amountVnd: 30000, note: "đi grab hết", categoryId: null, payerMemberId: null },
    });
    await mount();
    await waitFor(() => expect(categoryRow()).toHaveTextContent(/Di chuyển/));
  });

  it("keeps a category that was passed in", async () => {
    const { mount } = form({
      source: "voice",
      initial: { amountVnd: 30000, note: "đi grab hết", categoryId: catId("Giải trí"), payerMemberId: null },
    });
    await mount();
    await waitFor(() => expect(categoryRow()).toHaveTextContent(/Giải trí/));
  });

  it("leaves the category empty when the note has no keyword", async () => {
    const { mount } = form({
      source: "voice",
      initial: { amountVnd: 30000, note: "xyz abc", categoryId: null, payerMemberId: null },
    });
    await mount();
    await act(async () => {
      await Promise.resolve();
    });
    expect(categoryRow()).toHaveTextContent(/Chọn danh mục/);
  });

  it("does not guess for manual entry", async () => {
    const { mount } = form({ initial: { amountVnd: null, note: "đi grab", categoryId: null, payerMemberId: null } });
    await mount();
    await act(async () => {
      await Promise.resolve();
    });
    expect(categoryRow()).toHaveTextContent(/Chọn danh mục/);
  });
});
