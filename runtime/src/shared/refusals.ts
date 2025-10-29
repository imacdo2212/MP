export type RefusalAliases = Record<string, string>;

export function resolveRefusalCode(alias: string, aliases: RefusalAliases): string {
  if (!alias) {
    return 'UNKNOWN_REFUSAL';
  }

  const trimmed = alias.replace(/^REFUSAL\(/, '').replace(/\)$/, '').trim();
  if (trimmed in aliases) {
    return aliases[trimmed];
  }

  if (alias in aliases) {
    return aliases[alias];
  }

  return trimmed || alias;
}
