/** Display information for one keyhive identity. */
export interface Contact {
  peerId?: string;
  name?: string;
  avatar?: Uint8Array | null;
}

/** Hex-encoded keyhive identifier to display information. */
export type ContactMap = Record<string, Contact>;

/** An id abbreviated for display, used wherever a peer has no name. */
export function shortId(id: string, digits = 12): string {
  const bare = id.startsWith("0x") ? id.slice(2) : id;
  return bare.length <= digits ? `0x${bare}` : `0x${bare.slice(0, digits)}...`;
}
