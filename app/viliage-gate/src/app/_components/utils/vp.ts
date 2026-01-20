export const formatVp = (
  raw?: string | number | bigint,
  decimals = 3,
): string => {
  if (raw === undefined || raw === null) return "0";

  const rawString = typeof raw === "string" ? raw : raw.toString();
  const negative = rawString.startsWith("-");
  const normalized = negative ? rawString.slice(1) : rawString;
  const value = BigInt(normalized || "0");
  const base = 10n ** 18n;
  const whole = value / base;
  const fraction = value % base;

  const wholeStr = whole
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ",");

  if (decimals === 0) {
    return `${negative ? "-" : ""}${wholeStr}`;
  }

  const fractionStr = fraction.toString().padStart(18, "0").slice(0, decimals);
  return `${negative ? "-" : ""}${wholeStr}.${fractionStr}`;
};
