// Mint an onomancy certificate for a document you administer, in the browser.
//
// !! BLOCKED. This composes end to end and fails at the last step. Keyhive's
// !! only signing surface frames what it signs; onomancy expects the signable
// !! bytes signed verbatim. Nothing in the ecosystem bridges that today 2014 see
// !! the note at the signing call for the measurement. Kept rather than
// !! deleted because everything except the signature is correct and
// !! exercised, and because the failure is the useful artifact.
//
// A certificate is the reverse half of a DNS binding. The zone's TXT record
// says "this hostname designates that document"; the certificate, held *in*
// that document, says "and I accept". Without it a name resolves but earns no
// badge, because a record alone proves only that somebody who controls DNS
// pointed at you — not that you agreed.
//
// ## Why this could not be done here until now
//
// Certificate assembly needs a signature, and the signing key lives in ARK's
// keyhive, which never exports it. The Wasm module previously signed
// internally, so minting meant handing it a key that no browser holds. The
// primitives this composes — `signableBytes` and `encodeCertificate` — split
// that in half: the module says what bytes to sign, something else signs them,
// and the module reassembles. No key crosses the boundary in either direction.
//
// ## The four ingredients
//
//   1. signable bytes   what to sign, from the module
//   2. signature        from `hive.signData`, over those bytes
//   3. carriage         keyhive ops proving the signer administers the
//                       document, so a verifier can check it offline
//   4. chain            the validated DNSSEC chain, embedded so the
//                       certificate stands alone
//
// Three and four are what make a certificate self-contained: a verifier needs
// no keyhive sync and no DNS query to check one.

import type { AutomergeUrl } from "@automerge/react/slim";
import type { AutomergeRepoKeyhive } from "@automerge/automerge-repo-keyhive";
import {
  encodeCertificate,
  resolveHostname,
  signableBytes,
} from "@inkandswitch/onomancy";
import { carriageFor } from "./carriage";
import { log } from "./log";

/** Which framing a signature was found to cover. */
export type Framing = "verbatim" | "length-prefixed" | "neither";

const FRAMINGS: Record<
  Exclude<Framing, "neither">,
  (bytes: Uint8Array) => Uint8Array
> = {
  verbatim: (bytes) => bytes,
  // bincode's `Vec<u8>`: u64 little-endian length, then the bytes.
  "length-prefixed": (bytes) => {
    const framed = new Uint8Array(8 + bytes.length);
    new DataView(framed.buffer).setBigUint64(0, BigInt(bytes.length), true);
    framed.set(bytes, 8);
    return framed;
  },
};

/**
 * Report which framing `signature` actually covers.
 *
 * A diagnostic, not a security check — the verifier does the real work, and
 * this runs before it purely so a mismatch is legible.
 *
 * The reason it exists: every framing disagreement in this stack surfaces as
 * one opaque message, `signature does not cover the certificate's signed
 * region`. Several distinct causes produce it — the signer framed when the
 * format did not expect it, the format framed when the signer did not, or the
 * key is genuinely wrong — and the message distinguishes none of them. That
 * cost two upstream debugging rounds and one here.
 *
 * **What it can and cannot separate.** It reports what the signer did to the
 * bytes *it was handed*. So it tells you whether the signature is a framing
 * problem or a key problem, which the verifier's message does not. It cannot
 * tell you whether the bytes handed over were the right ones: if
 * `signableBytes` returned an already-framed payload, this still reports
 * `length-prefixed` quite happily and assembly fails downstream anyway.
 *
 * Narrower than it first looks, and worth saying so — a diagnostic trusted
 * past its range is worse than none.
 *
 * Returns `"neither"` when Ed25519 is unavailable in this browser, because an
 * absent diagnostic must never read as a failed one.
 */
export async function framingOf(
  signature: Uint8Array,
  verifyingKey: Uint8Array,
  payload: Uint8Array
): Promise<Framing | "undiagnosable"> {
  let key: CryptoKey;
  try {
    key = await crypto.subtle.importKey(
      "raw",
      verifyingKey as BufferSource,
      "Ed25519",
      false,
      ["verify"]
    );
  } catch {
    return "undiagnosable";
  }

  for (const [name, frame] of Object.entries(FRAMINGS)) {
    try {
      const covered = await crypto.subtle.verify(
        "Ed25519",
        key,
        signature as BufferSource,
        frame(payload) as BufferSource
      );
      if (covered) return name as Framing;
    } catch {
      // Try the next one; a throw here is not a verdict.
    }
  }
  return "neither";
}

export interface MintedCertificate {
  bytes: Uint8Array;
  hostname: string;
  document: AutomergeUrl;
  /** Unix seconds the certificate was issued at. */
  issuedAt: number;
  /** Sizes, because the byte budget is the thing most likely to surprise. */
  sizes: {
    carriageEntries: number;
    carriageBytes: number;
    chainBytes: number;
    signableBytes: number;
    certificateBytes: number;
  };
}

/**
 * Mint a certificate binding `hostname` to `docUrl`, signed by this identity.
 *
 * The signer must be a **direct admin** of the document. Not merely because
 * lesser access would be wrong, but because keyhive's `sanctioned` check reads
 * direct `members()` only: an admin reached through a group will be refused by
 * the verifier even though the app would call them an admin. The document's
 * own generated owner group cannot sign at all — `EphemeralSigner` destroys
 * the key at creation — so in practice the individual is the only candidate,
 * for two independent reasons.
 */
export async function mintCertificate(
  hive: AutomergeRepoKeyhive,
  hostname: string,
  docUrl: AutomergeUrl
): Promise<MintedCertificate> {
  // The chain comes from resolution rather than a fresh query: the certificate
  // must embed the *validated* chain, and validation is what `resolveHostname`
  // already did. Re-fetching would mean re-validating, and a chain that
  // verified a moment ago is the one we want to carry.
  const resolution = await resolveHostname(hostname);
  if (!resolution.chain || resolution.chain.length === 0) {
    throw new Error(
      `No validated DNSSEC chain for ${hostname}, so a certificate would have ` +
        `nothing to stand on.`
    );
  }

  const signer = hive.active.individual.id.toBytes();
  const carriage = await carriageFor(hive, docUrl);

  // Seconds, not milliseconds. The serial rule for records is a millisecond
  // clock; certificate issuance is not, and mixing them yields a certificate
  // dated fifty thousand years hence that grades `stale` for a very long time.
  const issuedAt = Math.floor(Date.now() / 1000);

  const toSign = signableBytes(docUrl, signer, issuedAt, hostname);

  // The one place a key would have had to cross the boundary, and does not:
  // keyhive signs, holding the key throughout, and yields only the signature.
  //
  // NOT `hive.signData`, which both this session and keyhive-react named as
  // the obvious home before anyone ran it. Two things are wrong with it. It
  // does not exist on `AutomergeRepoKeyhive` at all — only on the legacy
  // class, which this app does not use. And what it returns is not a
  // signature: it wraps one in `encodeKeyhiveMessageData({contactCard,
  // signed})` for the wire, so even on the legacy class it would have handed
  // onomancy an envelope where 64 raw bytes belong.
  //
  // `trySign` is the actual primitive underneath both.
  //
  // AND THIS IS WHERE IT BREAKS. `trySign` does not sign its input verbatim:
  // it signs `bincode(Vec<u8>)`, a u64 little-endian length prefix then the
  // bytes. Confirmed against WebCrypto Ed25519 over six candidate framings,
  // of which only the length-prefixed one verifies, and visible in
  // `Signed::toBytes()` 2014 signing `0102030405` yields
  // `0500000000000000 0102030405 <len> <vk> <sig>`.
  //
  // onomancy expects `signableBytes` signed as-is, so assembly refuses with
  // "signature does not cover the certificate's signed region". Neither side
  // is wrong; they disagree, and `trySign` is the only signing surface keyhive
  // exposes 2014 no raw variant exists on any object.
  const signed = await hive.keyhive.trySign(toSign);
  const signature = signed.signature;

  // Which framing did keyhive actually sign? Answered before assembly so a
  // mismatch names itself instead of arriving as the verifier's one opaque
  // message. Under `ONC\x00` the format wants `verbatim`; under `ONC\x01` it
  // wants `length-prefixed`, which is what keyhive produces.
  const framing = await framingOf(signature, signed.verifyingKey, toSign);
  log.debug(`Keyhive signed the  form of the signable bytes.`);
  if (framing === "neither") {
    throw new Error(
      "The signature covers neither the signable bytes nor their " +
        "length-prefixed form, so the disagreement is not a framing one. " +
        "Suspect the signing key rather than the encoding."
    );
  }

  // The signature must be by the key we told the certificate to expect. These
  // come from different objects — `active.individual.id` and the signer
  // keyhive actually used — and nothing but this check couples them. A
  // mismatch here would produce a certificate that fails verification for a
  // reason no verifier can report usefully.
  const usedKey = signed.verifyingKey;
  if (
    usedKey.length !== signer.length ||
    !usedKey.every((byte: number, index: number) => byte === signer[index])
  ) {
    throw new Error(
      "Keyhive signed with a different key than the certificate names as the " +
        "signer, so the certificate would never verify."
    );
  }

  const bytes = encodeCertificate(
    docUrl,
    signer,
    issuedAt,
    hostname,
    signature,
    carriage.entries,
    resolution.chain
  );

  const sizes = {
    carriageEntries: carriage.entries.length,
    carriageBytes: carriage.totalBytes,
    chainBytes: resolution.chain.length,
    signableBytes: toSign.length,
    certificateBytes: bytes.length,
  };
  log.info(`Minted a certificate for ${hostname}:`, sizes);

  return { bytes, hostname, document: docUrl, issuedAt, sizes };
}

/** Minting, attempted, with the failure classified rather than raw. */
export type MintOutcome =
  | { status: "minted"; certificate: MintedCertificate }
  | { status: "unavailable"; reason: string; detail: string }
  | { status: "failed"; reason: string };

/**
 * Attempt a mint and describe the result in terms the operator can act on.
 *
 * Deliberately attempts rather than checking a capability flag first. There is
 * no honest flag to check: whether minting works depends on what the signer
 * frames and what the format expects, which are decided in two other
 * repositories and could change under us at any reload. A hardcoded "not yet"
 * would be a claim about the world that this code cannot keep true.
 *
 * So it tries, and when the signing framing is the thing that stopped it, it
 * says so specifically. The consequence is the property worth having: **when
 * the upstream primitive lands, this starts working with no change here** —
 * nobody has to remember to flip a flag.
 */
export async function attemptMint(
  hive: AutomergeRepoKeyhive,
  hostname: string,
  docUrl: AutomergeUrl
): Promise<MintOutcome> {
  try {
    return {
      status: "minted",
      certificate: await mintCertificate(hive, hostname, docUrl),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    // The signature mismatch is the known blocker, and it is worth naming
    // precisely rather than surfacing as a failure the operator might think
    // they caused. Everything up to this point succeeded: the DNSSEC chain
    // validated, the carriage extracted, the bytes assembled.
    if (/signed region|signature does not cover/i.test(message)) {
      return {
        status: "unavailable",
        reason:
          "Everything needed for a certificate is here except a usable " +
          "signature. Keyhive will only sign its own framing of the bytes, " +
          "and the certificate format wants them unframed — an eight-byte " +
          "disagreement, in two other libraries. Nothing you can fix here.",
        detail: message,
      };
    }
    return { status: "failed", reason: message };
  }
}
