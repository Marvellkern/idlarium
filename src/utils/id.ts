export function uid(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID().slice(0, 13);
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}
