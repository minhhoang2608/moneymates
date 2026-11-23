// Renders docs/design/logo/icon.svg to PNG assets. Usage: npm run icons
import { readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { Resvg } from "@resvg/resvg-js";

const here = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const svg = readFileSync(resolve(here, "../../../docs/design/logo/icon.svg"), "utf8");
const fontFile = require.resolve("@expo-google-fonts/inter/800ExtraBold/Inter_800ExtraBold.ttf");

function render(source, size) {
  return new Resvg(source, {
    fitTo: { mode: "width", value: size },
    font: { fontFiles: [fontFile], loadSystemFonts: false, defaultFontFamily: "Inter" },
  })
    .render()
    .asPng();
}

const out = (name) => resolve(here, "../assets", name);

// Full icon (rounded square included).
writeFileSync(out("icon.png"), render(svg, 1024));
writeFileSync(out("favicon.png"), render(svg, 48));

// Adaptive foreground: no background rect, artwork scaled into the 66% safe zone.
const noBg = svg.replace(/<rect[^>]*\/>/, "");
const inner = noBg.replace(/<svg[^>]*>/, "").replace(/<\/svg>\s*$/, "");
const foreground = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 100 100"><g transform="translate(17 17) scale(0.66)">${inner}</g></svg>`;
writeFileSync(out("adaptive-icon.png"), render(foreground, 1024));
