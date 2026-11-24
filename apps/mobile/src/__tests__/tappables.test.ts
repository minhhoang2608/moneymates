import { readdirSync, readFileSync, statSync } from "fs";
import { join, relative } from "path";
import { findBareTappables } from "@/lib/lint/findBareTappables";

const root = join(__dirname, "..", "..");

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) return name === "__tests__" ? [] : walk(p);
    return /\.tsx?$/.test(name) && name !== "PressableScale.tsx" && name !== "findBareTappables.ts" ? [p] : [];
  });
}

describe("findBareTappables", () => {
  it("flags legacy touchables", () => {
    expect(findBareTappables('import { TouchableOpacity } from "react-native";')).toHaveLength(1);
    expect(findBareTappables("<TouchableHighlight onPress={f} />")).toHaveLength(1);
    expect(findBareTappables("<TouchableWithoutFeedback />")).toHaveLength(1);
  });
  it("flags a bare Pressable", () => {
    expect(findBareTappables("<Pressable onPress={f} />")).toEqual([expect.objectContaining({ line: 1 })]);
  });
  it("accepts PressableScale", () => {
    expect(findBareTappables("<PressableScale onPress={f} />")).toEqual([]);
  });
  it("accepts a bare Pressable with a reasoned marker on the previous line", () => {
    expect(findBareTappables("{/* bare-pressable-ok: modal backdrop */}\n<Pressable />")).toEqual([]);
    expect(findBareTappables("// bare-pressable-ok: backdrop\n<Pressable />")).toEqual([]);
  });
  it("rejects a marker without a reason or not directly above", () => {
    expect(findBareTappables("// bare-pressable-ok:\n<Pressable />")).toHaveLength(1);
    expect(findBareTappables("// bare-pressable-ok: x\n\n<Pressable />")).toHaveLength(1);
  });
});

describe("pressed feedback on every tappable", () => {
  it("has no bare Pressable or legacy Touchable in src/ and app/", () => {
    const problems = [...walk(join(root, "src")), ...walk(join(root, "app"))].flatMap((f) =>
      findBareTappables(readFileSync(f, "utf8")).map((x) => `${relative(root, f)}:${x.line} ${x.message}`),
    );
    expect(problems).toEqual([]);
  });
});
