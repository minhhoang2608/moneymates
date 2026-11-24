/**
 * Finds tappable elements that bypass `PressableScale` (and so give no pressed feedback).
 * A bare `<Pressable` is allowed only with `bare-pressable-ok: <reason>` in a comment on the line above.
 */
const LEGACY = ["TouchableOpacity", "TouchableHighlight", "TouchableWithoutFeedback"];
const MARKER = /bare-pressable-ok:\s*(\S.*?)\s*(\*\/\}?|$)/;

export type BareTappable = { line: number; message: string };

export function findBareTappables(source: string): BareTappable[] {
  const lines = source.split("\n");
  const found: BareTappable[] = [];
  lines.forEach((text, i) => {
    const line = i + 1;
    for (const name of LEGACY) {
      if (new RegExp(`\\b${name}\\b`).test(text))
        found.push({ line, message: `${name} has no pressed feedback; use PressableScale` });
    }
    if (/<Pressable(?![A-Za-z])/.test(text)) {
      const prev = i > 0 ? lines[i - 1] : "";
      if (!MARKER.test(prev)) {
        found.push({
          line,
          message: "bare <Pressable> needs PressableScale or a `bare-pressable-ok: <reason>` comment above",
        });
      }
    }
  });
  return found;
}
