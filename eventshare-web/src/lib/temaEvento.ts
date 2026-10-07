export function esMatrimonio(name: string): boolean {
  return /\b(boda|matrimonio)\b/i.test(name);
}
