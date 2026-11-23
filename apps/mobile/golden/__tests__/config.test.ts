import fs from "fs";
import path from "path";

const root = path.resolve(__dirname, "../..");

test("app.json names the app MoneyMates", () => {
  const app = JSON.parse(fs.readFileSync(path.join(root, "app.json"), "utf8"));
  expect(app.expo.name).toBe("MoneyMates");
});

test("the env example has only EXPO_PUBLIC_* keys with placeholder values", () => {
  const lines = fs
    .readFileSync(path.join(root, ".env" + ".example"), "utf8")
    .split("\n")
    .filter((l) => l.trim() && !l.startsWith("#"));
  expect(lines.length).toBeGreaterThan(0);
  for (const line of lines) {
    const [key, value] = line.split("=");
    expect(key).toMatch(/^EXPO_PUBLIC_[A-Z0-9_]+$/);
    expect(key).not.toMatch(/KEY|SECRET|TOKEN|PASSWORD/);
    expect(value).toMatch(/^(0|1|https:\/\/[a-z.]+\.invalid)$/);
  }
});
