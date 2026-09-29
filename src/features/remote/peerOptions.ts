import type { PeerOptions } from 'peerjs';
import type { PeerServer } from '@/core/remote/security';
import type { RemoteSettings } from '@/stores/settingsSchema';

const PUBLIC_SERVER = { host: '0.peerjs.com', port: 443, path: '/', secure: true };

/** The signaling server from the settings, or null for PeerJS's public server with its defaults. */
export function serverFromSettings(remote: RemoteSettings): PeerServer | null {
  const host = remote.peerHost.trim();
  if (!host && !remote.iceServers) return null;
  if (!host) return { ...PUBLIC_SERVER, ice: remote.iceServers };
  return {
    host,
    port: remote.peerPort,
    path: remote.peerPath.trim() || '/',
    secure: remote.secure,
    ice: remote.iceServers,
  };
}

export function peerOptions(server: PeerServer | null): PeerOptions {
  const options: PeerOptions = { debug: 0 };
  if (!server) return options;
  options.host = server.host;
  options.port = server.port ?? (server.secure ? 443 : 80);
  options.path = server.path || '/';
  options.secure = server.secure;
  if (server.ice) options.config = { iceServers: server.ice };
  return options;
}

/** A short device label shown to the operator ("iPhone", "Android"…). */
export function deviceName(userAgent = navigator.userAgent): string {
  if (/iPhone/.test(userAgent)) return 'iPhone';
  if (/iPad/.test(userAgent)) return 'iPad';
  if (/Android/.test(userAgent)) return 'Android';
  if (/Mac OS X/.test(userAgent)) return 'Mac';
  if (/Windows/.test(userAgent)) return 'Windows';
  return 'Browser';
}
