const UNITS = ["", "K", "M", "B", "T", "Qa", "Qi"];

/** Short number formatting: 950, 1.2K, 3.4M. */
export function fmt(n: number): string {
  if (!Number.isFinite(n)) return "0";
  const neg = n < 0;
  n = Math.abs(n);
  if (n < 1000) {
    const s = n < 10 && n % 1 !== 0 ? n.toFixed(1) : Math.floor(n).toString();
    return (neg ? "-" : "") + s;
  }
  let i = 0;
  while (n >= 1000 && i < UNITS.length - 1) {
    n /= 1000;
    i++;
  }
  const s = n >= 100 ? Math.floor(n).toString() : n.toFixed(1).replace(/\.0$/, "");
  return (neg ? "-" : "") + s + UNITS[i];
}

/** Income per second, keeps one decimal for small values. */
export function fmtRate(n: number): string {
  if (n < 10) return n.toFixed(1);
  return fmt(n);
}

export function fmtDuration(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h > 0) return m > 0 ? `${h}h ${m}m` : `${h}h`;
  if (m > 0) return `${m}m`;
  return `${s}s`;
}
