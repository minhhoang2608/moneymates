import { useMemo } from "react";
import Svg, { Circle, ClipPath, Defs, G, Rect, Text as SvgText, TSpan } from "react-native-svg";

import { buildQrImageContent, computeQrImageLayout, qrMatrix, type QrImageInput } from "@/lib/share/qrTemplate";

// Text grey from the design export (QrImage.dc.html); not a theme token.
const TEXT_GREY = "#374151";
const FOOTER_GREY = "#5B6472";
const INK = "#111827";
const GREEN = "#0E7C66";

type Props = QrImageInput & {
  getRef?: (r: { toDataURL: (cb: (data: string) => void) => void } | null) => void;
};

/** The 600×900 transfer image handed to bank apps (design: mockup 27). Rendered off-screen, exported as PNG. */
export function QrImageTemplate({ getRef, ...input }: Props) {
  const { name, bankBin, bankName, account, amount, message } = input;
  const content = useMemo(
    () => buildQrImageContent({ name, bankBin, bankName, account, amount, message }),
    [name, bankBin, bankName, account, amount, message],
  );
  const matrix = useMemo(() => qrMatrix(content.payload), [content.payload]);
  const L = computeQrImageLayout(matrix.size, {
    hasTitle: content.title !== null,
    hasAmount: content.amountLine !== null,
    hasMessage: content.messageLine !== null,
  });

  const cells: React.ReactElement[] = [];
  for (let r = 0; r < matrix.size; r++) {
    for (let c = 0; c < matrix.size; c++) {
      if (matrix.isDark(r, c)) {
        cells.push(
          <Rect
            key={`${r}-${c}`}
            x={L.qrOrigin.x + c * L.moduleSize}
            y={L.qrOrigin.y + r * L.moduleSize}
            width={L.moduleSize}
            height={L.moduleSize}
            fill="#000000"
          />,
        );
      }
    }
  }

  const common = { x: L.centerX, textAnchor: "middle" as const };
  const logoX = L.centerX - 83;

  return (
    <Svg
      ref={getRef as never}
      testID="qr-image-template"
      width={L.width}
      height={L.height}
      viewBox={`0 0 ${L.width} ${L.height}`}
    >
      <Rect x={0} y={0} width={L.width} height={L.height} fill="#FFFFFF" />
      <G x={logoX} y={L.logoY}>
        <Defs>
          <ClipPath id="lc36">
            <Circle cx={14.4} cy={18} r={7.92} />
          </ClipPath>
        </Defs>
        <Rect width={36} height={36} rx={8.3} fill={GREEN} />
        <Circle cx={14.4} cy={18} r={7.92} fill="#FFFFFF" />
        <Circle cx={21.6} cy={18} r={7.92} fill="#3DD6B0" />
        <Circle cx={21.6} cy={18} r={7.92} fill="#0A5E4D" clipPath="url(#lc36)" />
        <SvgText x={10.4} y={21} textAnchor="middle" fontFamily="Inter_800ExtraBold" fontSize={8.6} fill={GREEN}>
          $
        </SvgText>
        <SvgText x={46} y={26} fontFamily="Inter_800ExtraBold" fontSize={24} letterSpacing={-1}>
          <TSpan fill={INK}>Money</TSpan>
          <TSpan fill={GREEN}>Mates</TSpan>
        </SvgText>
      </G>
      <Rect x={L.box.x} y={L.box.y} width={L.box.size} height={L.box.size} fill="#FFFFFF" />
      <G shapeRendering="crispEdges">{cells}</G>
      {content.title && L.title ? (
        <SvgText
          {...common}
          y={L.title.baseline}
          fontFamily="Inter_700Bold"
          fontSize={26}
          letterSpacing={0.3}
          fill={INK}
        >
          {content.title}
        </SvgText>
      ) : null}
      <SvgText {...common} y={L.bank.baseline} fontFamily="Inter_400Regular" fontSize={20} fill={TEXT_GREY}>
        {content.bankLine}
      </SvgText>
      {content.amountLine && L.amount ? (
        <SvgText {...common} y={L.amount.baseline} fontFamily="Inter_700Bold" fontSize={40} fill={GREEN}>
          {content.amountLine}
        </SvgText>
      ) : null}
      {content.messageLine && L.message ? (
        <SvgText {...common} y={L.message.baseline} fontFamily="Inter_400Regular" fontSize={18} fill={TEXT_GREY}>
          {content.messageLine}
        </SvgText>
      ) : null}
      <SvgText {...common} y={L.footer.baseline} fontFamily="Inter_400Regular" fontSize={15} fill={FOOTER_GREY}>
        {content.footer}
      </SvgText>
    </Svg>
  );
}
