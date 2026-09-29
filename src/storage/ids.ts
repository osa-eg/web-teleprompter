const ALPHABET = '0123456789abcdefghjkmnpqrstvwxyz';

/**
 * Random base32 identifier. Uses `getRandomValues`, which (unlike `crypto.randomUUID`) also works
 * in insecure contexts such as a LAN dev server over plain http.
 */
export function randomId(length = 16): string {
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  let id = '';
  for (const byte of bytes) id += ALPHABET[byte & 31];
  return id;
}
