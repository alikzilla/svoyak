import os from 'node:os';

export interface NetIface {
  address: string;
  family: string;
  internal: boolean;
}

/** Адреса домашних сетей — их предпочитаем всему остальному (VPN, Tailscale и т.п.). */
function isPrivate(address: string): boolean {
  return (
    address.startsWith('192.168.') ||
    address.startsWith('10.') ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(address)
  );
}

export function pickLanAddress(ifaces: Record<string, NetIface[] | undefined>): string | null {
  const candidates: string[] = [];
  for (const list of Object.values(ifaces)) {
    for (const iface of list ?? []) {
      if (iface.family === 'IPv4' && !iface.internal) candidates.push(iface.address);
    }
  }
  return candidates.find(isPrivate) ?? candidates[0] ?? null;
}

export function getLanAddress(): string | null {
  return pickLanAddress(os.networkInterfaces() as Record<string, NetIface[] | undefined>);
}
