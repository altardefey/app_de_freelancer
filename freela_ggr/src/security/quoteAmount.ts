export function parseAmount(value: string): number | null {
  const cleaned = value.trim().replace(/^R\$\s*/, "");
  if (!/^(?:\d+|\d{1,3}(?:\.\d{3})+)(?:,\d{1,2})?$/.test(cleaned)) return null;
  const [whole, fraction = ""] = cleaned.replace(/\./g, "").split(",");
  const cents = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  return Number.isSafeInteger(cents) && cents > 0 && cents <= 999999999
    ? cents
    : null;
}
