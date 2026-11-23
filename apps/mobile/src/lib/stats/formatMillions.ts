/** Display only: integer VND -> millions with a comma decimal, at most 2 decimals ("8,45", "25", "0"). */
export function formatMillions(vnd: number): string {
  const hundredths = Math.round(vnd / 10_000);
  const whole = Math.floor(hundredths / 100);
  const frac = String(hundredths % 100)
    .padStart(2, "0")
    .replace(/0+$/, "");
  return frac ? `${whole},${frac}` : String(whole);
}
