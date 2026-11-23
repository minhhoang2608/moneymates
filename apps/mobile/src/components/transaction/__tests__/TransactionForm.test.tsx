import { act, fireEvent, screen, waitFor } from "@testing-library/react-native";

import { TransactionForm } from "../TransactionForm";
import { catId, setup } from "@/testing/repoTestUtils";

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

describe("TransactionForm", () => {
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
    expect(screen.getByTestId("photo-thumbnail").props.source).toEqual({ uri: "file:///doc/p.jpg" });
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
});
