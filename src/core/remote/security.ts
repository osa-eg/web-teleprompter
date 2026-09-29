import { z } from 'zod';

const ID_ALPHABET = '0123456789abcdefghijklmnopqrstuvwxyz';

/** Host peer id: public (the signaling server sees it), random so it cannot be guessed. */
export function newHostId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(20));
  let id = 'tp-';
  for (const byte of bytes) id += ID_ALPHABET[byte % 36];
  return id;
}

function base64url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** 128-bit secret; only ever travels in the link's #fragment and over the encrypted data channel. */
export function newSecret(): string {
  return base64url(crypto.getRandomValues(new Uint8Array(16)));
}

/** Compares secrets in constant time (no early exit on the first difference). */
export function safeEqual(a: string, b: string): boolean {
  let diff = a.length ^ b.length;
  const length = Math.max(a.length, b.length);
  for (let i = 0; i < length; i++) diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return diff === 0;
}

/** Token bucket: `rate` tokens per second, bursts up to `capacity`. */
export class TokenBucket {
  private tokens: number;
  private last: number | null = null;
  private readonly rate: number;
  private readonly capacity: number;

  constructor(rate: number, capacity = rate) {
    this.rate = rate;
    this.capacity = capacity;
    this.tokens = capacity;
  }

  take(now: number): boolean {
    if (this.last !== null)
      this.tokens = Math.min(this.capacity, this.tokens + ((now - this.last) / 1000) * this.rate);
    this.last = now;
    if (this.tokens < 1) return false;
    this.tokens -= 1;
    return true;
  }
}

/** A custom PeerJS signaling server (the default public one needs no configuration). */
export const PeerServerSchema = z.object({
  host: z.string().min(1).max(253),
  port: z.number().int().min(1).max(65_535).nullable(),
  path: z.string().max(200),
  secure: z.boolean(),
  ice: z
    .array(
      z.object({
        urls: z.union([z.string().max(500), z.array(z.string().max(500)).max(10)]),
        username: z.string().max(200).optional(),
        credential: z.string().max(200).optional(),
      }),
    )
    .max(10)
    .nullable(),
});
export type PeerServer = z.infer<typeof PeerServerSchema>;

export interface RemoteLink {
  hostId: string;
  key: string;
  server: PeerServer | null;
}

const HOST_ID = /^tp-[0-9a-z]{20}$/;
const KEY = /^[\w-]{16,64}$/;

/** `…#/remote?h=<host id>&k=<secret>[&s=<server>]` */
export function buildRemoteLink(base: string, link: RemoteLink): string {
  const params = new URLSearchParams({ h: link.hostId, k: link.key });
  if (link.server) {
    params.set('s', base64url(new TextEncoder().encode(JSON.stringify(link.server))));
  }
  const url = new URL(base);
  url.hash = `#/remote?${params.toString()}`;
  return url.href;
}

/** Reads the parameters of a remote link (from the router's search params). */
export function parseRemoteLink(params: URLSearchParams): RemoteLink | null {
  const hostId = params.get('h') ?? '';
  const key = params.get('k') ?? '';
  if (!HOST_ID.test(hostId) || !KEY.test(key)) return null;
  let server: PeerServer | null = null;
  const encoded = params.get('s');
  if (encoded) {
    try {
      const binary = atob(encoded.replace(/-/g, '+').replace(/_/g, '/'));
      const json: unknown = JSON.parse(
        new TextDecoder().decode(Uint8Array.from(binary, (c) => c.charCodeAt(0))),
      );
      const parsed = PeerServerSchema.safeParse(json);
      if (!parsed.success) return null;
      server = parsed.data;
    } catch {
      return null;
    }
  }
  return { hostId, key, server };
}
