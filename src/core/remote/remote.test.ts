import { describe, expect, it } from 'vitest';
import {
  isRemoteCommandAllowed,
  MAX_PHONE_MESSAGE,
  parseHostMessage,
  parsePhoneMessage,
  PHONE_RATE,
} from './protocol';
import {
  buildRemoteLink,
  newHostId,
  newSecret,
  parseRemoteLink,
  safeEqual,
  TokenBucket,
  type PeerServer,
} from './security';

describe('remote protocol', () => {
  it('accepts well-formed phone messages', () => {
    const key = newSecret();
    expect(parsePhoneMessage(JSON.stringify({ t: 'auth', v: 1, key, name: 'iPhone' }))).toEqual({
      t: 'auth',
      v: 1,
      key,
      name: 'iPhone',
    });
    expect(parsePhoneMessage(JSON.stringify({ t: 'cmd', cmd: { type: 'jumpBlock', delta: 1 } }))).toEqual({
      t: 'cmd',
      cmd: { type: 'jumpBlock', delta: 1 },
    });
    expect(parsePhoneMessage('{"t":"ping"}')).toEqual({ t: 'ping' });
  });

  it('rejects anything else before parsing too much', () => {
    expect(parsePhoneMessage({ t: 'ping' })).toBeNull(); // not a string
    expect(parsePhoneMessage('not json')).toBeNull();
    expect(parsePhoneMessage('{"t":"shutdown"}')).toBeNull();
    expect(parsePhoneMessage(JSON.stringify({ t: 'cmd', cmd: { type: 'seekPos', pos: -5 } }))).toBeNull();
    expect(parsePhoneMessage(JSON.stringify({ t: 'cmd', cmd: { type: 'nudgeWpm', steps: 1e9 } }))).toBeNull();
    const huge = JSON.stringify({
      t: 'auth',
      v: 1,
      key: 'k'.repeat(20),
      name: 'x'.repeat(MAX_PHONE_MESSAGE),
    });
    expect(parsePhoneMessage(huge)).toBeNull();
    expect(parsePhoneMessage(JSON.stringify({ t: 'auth', v: 2, key: newSecret(), name: '' }))).toBeNull();
  });

  it('validates host messages', () => {
    expect(parseHostMessage('{"t":"welcome","v":1,"script":null}')).toEqual({
      t: 'welcome',
      v: 1,
      script: null,
    });
    expect(parseHostMessage('{"t":"denied","reason":"key"}')).toEqual({ t: 'denied', reason: 'key' });
    expect(parseHostMessage('{"t":"state","s":{"play":"flying"}}')).toBeNull();
  });

  it('only lets phones control playback, and the look when allowed', () => {
    expect(isRemoteCommandAllowed({ type: 'toggle' }, false)).toBe(true);
    expect(isRemoteCommandAllowed({ type: 'gotoMarker', index: 2 }, false)).toBe(true);
    expect(isRemoteCommandAllowed({ type: 'toggleMirror', axis: 'h' }, false)).toBe(false);
    expect(isRemoteCommandAllowed({ type: 'toggleMirror', axis: 'h' }, true)).toBe(true);
    expect(isRemoteCommandAllowed({ type: 'exit' }, true)).toBe(false);
    expect(isRemoteCommandAllowed({ type: 'toggleFullscreen' }, true)).toBe(false);
  });
});

describe('remote security', () => {
  it('makes unguessable ids and secrets', () => {
    expect(newHostId()).toMatch(/^tp-[0-9a-z]{20}$/);
    expect(newSecret()).toMatch(/^[\w-]{22}$/);
    expect(newSecret()).not.toBe(newSecret());
  });

  it('compares secrets exactly', () => {
    expect(safeEqual('abcdef', 'abcdef')).toBe(true);
    expect(safeEqual('abcdef', 'abcdeg')).toBe(false);
    expect(safeEqual('abcdef', 'abcde')).toBe(false);
    expect(safeEqual('', 'a')).toBe(false);
  });

  it('limits the message rate with bursts', () => {
    const bucket = new TokenBucket(PHONE_RATE);
    let accepted = 0;
    for (let i = 0; i < 100; i++) if (bucket.take(0)) accepted++;
    expect(accepted).toBe(PHONE_RATE);
    expect(bucket.take(10)).toBe(false);
    expect(bucket.take(100)).toBe(true); // 100 ms later: 3 tokens back
  });

  it('round-trips remote links, with and without a custom server', () => {
    const hostId = newHostId();
    const key = newSecret();
    const base = 'https://example.github.io/web-teleprompter/#/s/abc/prompt';
    const plain = buildRemoteLink(base, { hostId, key, server: null });
    expect(plain.startsWith('https://example.github.io/web-teleprompter/#/remote?h=')).toBe(true);
    const query = (href: string) => new URLSearchParams(new URL(href).hash.split('?')[1]);
    expect(parseRemoteLink(query(plain))).toEqual({ hostId, key, server: null });

    const server: PeerServer = {
      host: 'peer.example.com',
      port: 9000,
      path: '/tp',
      secure: true,
      ice: [{ urls: 'turn:turn.example.com:3478', username: 'u', credential: 'c' }],
    };
    const custom = buildRemoteLink(base, { hostId, key, server });
    expect(parseRemoteLink(query(custom))).toEqual({ hostId, key, server });
  });

  it('rejects broken links', () => {
    expect(parseRemoteLink(new URLSearchParams('h=tp-abc&k=short'))).toBeNull();
    expect(parseRemoteLink(new URLSearchParams(`h=${newHostId()}&k=${newSecret()}&s=%%%`))).toBeNull();
    expect(parseRemoteLink(new URLSearchParams(`k=${newSecret()}`))).toBeNull();
  });
});
