export type CapabilityMode = 'stub' | 'disabled' | 'live';

function normalizeEnvKey(name: string): string {
  return name
    .replace(/[^a-zA-Z0-9]/g, '_')
    .replace(/_{2,}/g, '_')
    .replace(/^_|_$/g, '')
    .toUpperCase();
}

export function resolveCapabilityMode(name: string, explicit?: CapabilityMode): CapabilityMode {
  if (explicit) {
    return explicit;
  }

  const envKey = `CAPABILITY_${normalizeEnvKey(name)}_MODE`;
  const rawValue = process.env[envKey];
  if (!rawValue) {
    return 'stub';
  }

  switch (rawValue.toLowerCase()) {
    case 'stub':
      return 'stub';
    case 'disabled':
      return 'disabled';
    case 'live':
      return 'live';
    default:
      return 'stub';
  }
}

export type CapabilityModesConfig<TName extends string> = Partial<Record<TName, CapabilityMode>>;
