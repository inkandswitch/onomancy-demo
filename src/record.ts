// The `v=ONO0` DNS binding record.
//
// Pure wire format: no onomancy, no automerge, no DOM beyond base64. Kept
// apart from onomancy.ts so the format can be exercised without loading a Wasm
// module, and because writing a record and reading one back are two halves of
// a single definition that should not drift.

/** A document id is an ed25519 verifying key, so always exactly this long. */
export const DOCUMENT_ID_BYTES = 32;

/**
 * Strict within the known tag, per the DNS anchoring spec: exact field order,
 * known fields only. Anything else is not a v=ONO0 record.
 */
const RECORD =
  /^v=ONO0;k=ed25519;n=(\d+);g=([A-Za-z0-9+/]+={0,2});p=([A-Za-z0-9+/]+={0,2})$/;

export interface BindingRecord {
  /** Monotonic counter, letting a resolver order records seen out of order. */
  generation: number;
  /** The identity that published the binding. */
  generationKey: Uint8Array;
  /** The document the domain designates. */
  documentId: Uint8Array;
}

/**
 * The record a domain publishes at `_onomancy.<domain>`.
 *
 * `now` defaults to wall-clock time, which is a serviceable monotonic counter
 * for a demo but not a good one: two records minted in the same millisecond
 * tie, and a clock that steps backwards mints one that looks older.
 */
export function bindingRecord(
  generationKey: Uint8Array,
  documentId: Uint8Array,
  now: number = Date.now()
): string {
  return [
    "v=ONO0",
    "k=ed25519",
    `n=${now}`,
    `g=${bytesToBase64(generationKey)}`,
    `p=${bytesToBase64(documentId)}`,
  ].join(";");
}

/**
 * Read a record back, or `undefined` when it is not a well-formed one.
 *
 * Unparseable is absent rather than an error, so one malformed record among a
 * domain's several cannot deny the others.
 */
export function parseBindingRecord(record: string): BindingRecord | undefined {
  const match = record.match(RECORD);
  if (!match) return undefined;

  const generation = Number(match[1]);
  if (!Number.isSafeInteger(generation)) return undefined;

  const generationKey = base64ToBytes(match[2]);
  const documentId = base64ToBytes(match[3]);
  if (generationKey === undefined || documentId === undefined) return undefined;
  if (documentId.length !== DOCUMENT_ID_BYTES) return undefined;

  return { generation, generationKey, documentId };
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function base64ToBytes(base64: string): Uint8Array | undefined {
  try {
    return Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
  } catch {
    return undefined;
  }
}
