// Inlined rather than imported from ARK, which this package does not import
// at runtime. See runtime.ts.

export function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function hexToBytes(hex: string): Uint8Array {
  const bare = hex.startsWith("0x") ? hex.slice(2) : hex;
  if (bare.length % 2 !== 0 || !/^[0-9a-f]*$/i.test(bare)) {
    throw new Error(`Not a hex-encoded id: "${hex}"`);
  }
  const bytes = new Uint8Array(bare.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = Number.parseInt(bare.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

/** Strip the per-session suffix, leaving the bare verifying key. */
export function peerIdWithoutSuffix(peerId: string): string {
  return peerId.split("-")[0];
}
