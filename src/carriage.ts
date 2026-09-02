// The authority carriage: the proof that a signer may speak for a document.
//
// A certificate carries its authority as opaque `Signed<Delegation>` units,
// doc root to signer. Onomancy fixes what those bytes are when keyhive is the
// authority: a version tag followed by one bincode-encoded `StaticEvent` each.
// Keyhive's `JsEvent.toBytes()` produces exactly that encoding, so extraction
// is a filter over events keyhive already holds rather than anything minted.
//
// UNEXERCISED: no certificate built from this has yet been accepted by a
// verifier. The encoder accepts the entries; that is the encoder.s opinion of
// them, not a verifier.s.

import type { AutomergeUrl } from "@automerge/react/slim";
import {
  docIdFromAutomergeUrl,
  type AutomergeRepoKeyhive,
} from "@automerge/automerge-repo-keyhive";
import { log } from "./log";

/** One serialized `StaticEvent`, as a carriage entry. */
export type CarriageEntry = Uint8Array;

export interface Carriage {
  entries: CarriageEntry[];
  /** Delegations naming this document as their subject. */
  delegations: number;
  /** Prekey operations, which introduce keys a delegation names. */
  introductions: number;
  totalBytes: number;
}

function hex(bytes: Uint8Array): string {
  return [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * The carriage proving this identity may sign for `docUrl`.
 *
 * Two kinds of entry, and both are needed:
 *
 * **Delegations** naming the document as subject. Filtered rather than taken
 * whole because `membershipOpsForAgent` is scoped to the *agent*, so it spans
 * every document that agent has touched — 7 ops across several documents in
 * one measurement here, against 1 for an identity that had touched one.
 *
 * **Introductions** — prekey operations. Keyhive resolves a delegation's
 * delegate against known individuals, so a chain naming a key it has not been
 * introduced to cannot ingest. Onomancy's own `mint` builds exactly this pair:
 * one `AddKeyOp` introduction plus one delegation, 318 bytes together. A
 * carriage of delegations alone is a structurally different bundle that merely
 * has a similar shape, and is the predicted first failure.
 *
 * Erring toward a superset is safe and deliberate. The verifier replays
 * entries to a fixpoint and only fails on an entry that *never* ingests, so a
 * spare prekey op costs 140 bytes and nothing else — while a missing one costs
 * the whole proof, with no indication which entry was responsible.
 *
 * ## The superset does not stay cheap, and the fix is known
 *
 * `agent.keyOps()` is scoped to the **agent**, so it grows with the identity's
 * age rather than with the document. Seven ops on a fresh identity is the
 * floor, not the shape: an identity that has rotated keys many times carries a
 * proportionally larger introduction set, while the delegations for any one
 * document stay at two. On a fresh identity the carriage runs around 1.5 KB
 * against a 2.5 KB DNSSEC chain: the chain dominates, but only by about 1.8x,
 * and that ratio moves one way over time.
 *
 * There is a hard ceiling at `MAX_UNIT_BYTES = 1 << 20`, so nothing breaks
 * quietly — an oversize unit fails loudly at signing rather than silently at
 * verification. But the reason to keep certificates small is gossip, and that
 * argument degrades long before a megabyte.
 *
 * **The trimming rule, when it is needed:** take prekey ops only for keys
 * *named in the selected delegations*, rather than every op the agent holds.
 * That is document-scoped, so it stops growing. Deliberately not done now: it
 * cannot be attempted safely until a failed replay can say which entry never
 * ingested, since the failure mode of trimming too far is the same opaque
 * `None` as every other carriage defect.
 */
/**
 * Why the signer is always this identity, and never the document's owner group.
 *
 * A fresh `repo.create2` document has **two** direct Admins: this identity, and
 * a per-document *generated owner group* that keyhive-react filters out of
 * member lists as machinery. It is root-delegated and holds Admin, so it looks
 * like the document's truest owner and therefore like the natural signer.
 *
 * **It cannot sign.** `Group::generate` mints its key inside
 * `EphemeralSigner::with_signer`, a signer that exists for one closure and is
 * then forgotten — and `JsGroup` exposes `id`, `groupId`, `toPeer`, `toAgent`,
 * `toMembered` and no signing surface at all, because there is nothing behind
 * one. The absence is a property, not an omission.
 *
 * This is the same mechanism as ADR-023: keyhive destroys the document root's
 * signing key at creation for the same reason, which is what made `onomancer
 * bind` unable to bind an ARK document. One design decision, two consequences,
 * and both look like missing features from outside.
 *
 * ## Who CAN sign, which is broader than this function's choice
 *
 * The design is that **any admin may sign** — that is what makes "ownership of
 * a name is whoever the document grants admin to" true, and it is implemented.
 * `sanctioned` looks the signer up in the document's members and checks the
 * delegating hop held admin, so a co-owner invited through the share modal can
 * mint certificates for the same name. Ownership really is shared by inviting
 * another admin rather than by editing DNS.
 *
 * Two exceptions, unrelated to each other and easy to merge by mistake:
 *
 * 1. **Admin held *through a group* does not qualify.** `sanctioned` reads
 *    `members()`, which is direct-only, and its own doc comment says naming
 *    chains through nested intermediaries are future work. Onomancy carries a
 *    failing `#[ignore]`d test for exactly this. So invite a namestore
 *    co-owner **directly**; granting them admin via a group leaves them able
 *    to write names and unable to certify them, which is a confusing pair.
 * 2. **The owner group cannot sign at all**, per the key destruction above.
 *    That is not a traversal gap but an absent key, and no future work fixes
 *    it.
 *
 * This function signs as the running identity because that is who is here, not
 * because it is the only identity permitted.
 */
export async function carriageFor(
  hive: AutomergeRepoKeyhive,
  docUrl: AutomergeUrl
): Promise<Carriage> {
  const docId = hex(docIdFromAutomergeUrl(docUrl).toBytes());
  const individual = hive.active.individual;
  const agent = individual.toAgent();

  const entries: CarriageEntry[] = [];
  let delegations = 0;
  let introductions = 0;

  const ops = await hive.keyhive.membershipOpsForAgent(agent);
  for (const op of ops.values()) {
    const signed = op.tryIntoSignedDelegation?.();
    if (!signed) continue;
    // `subjectId` is the document the delegation is about. Comparing it is
    // what makes an agent-scoped set document-scoped, and it needs no bincode
    // decoding — the wrapper exposes it directly.
    if (hex(signed.subjectId.toBytes()) !== docId) continue;
    entries.push(op.toBytes());
    delegations += 1;
  }

  const keyOps = await agent.keyOps();
  for (const bytes of keyOps.values()) {
    if (bytes instanceof Uint8Array) {
      entries.push(bytes);
      introductions += 1;
    }
  }

  const totalBytes = entries.reduce((sum, e) => sum + e.length, 0);
  log.debug(
    `onomancy: carriage for ${docUrl} — ${delegations} delegation(s), ` +
      `${introductions} introduction(s), ${totalBytes} bytes`
  );

  if (delegations === 0) {
    // Not thrown: an empty carriage is a real state for a document this
    // identity has no delegation on, and the caller decides whether that is
    // an error. But it will never verify, so it should never be silent.
    log.warn(
      `onomancy: no delegation naming ${docUrl} — this identity cannot sign for it`
    );
  }

  return { entries, delegations, introductions, totalBytes };
}
