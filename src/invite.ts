// Invite links.
//
// An invite link carries a throwaway keyhive identity, an Ed25519 key pair plus
// that identity's prekey secrets. Creating a link mints such an identity and
// delegates the document to it once. Opening the link rebuilds the identity in
// the visitor's browser and the visitor uses it to delegate the document to
// their own identity.
//
// The link is a bearer capability and is multi-use.
//
// Two people opening the same link at the same moment is handled here. Both
// reconstruct the same identity, the sync server sees it on two live
// connections, and one of them never receives the document's keyhive state.
// That grants nothing, so the redemption retries with a fresh session.
//
// The person who created a link can turn it off by revoking the invite identity
// in the share modal, where it appears as an ordinary member under the name
// this module publishes for it. Keyhive re-roots the people who joined through
// it, so revoking a link does not remove them.
//
// This is demo code. Anyone who sees the URL gets the access it carries.

import {
  Access,
  AutomergeRepoKeyhive,
  CiphertextStore,
  ContactCard,
  DocumentId as KeyhiveDocumentId,
  initializeAutomergeRepoKeyhive,
  initKeyhiveWasm,
  Keyhive,
  Signer,
  uint8ArrayToHex,
} from "@automerge/automerge-repo-keyhive";
import {
  AutomergeUrl,
  isValidAutomergeUrl,
  parseAutomergeUrl,
  type Chunk,
  type StorageAdapterInterface,
  type StorageKey,
} from "@automerge/react/slim";
// The redemption path builds a second, short-lived Repo for the invite
// identity, so it needs the full entry the same way main.tsx does.
// eslint-disable-next-line automerge-slimport/enforce-automerge-slim-import
import { Repo } from "@automerge/automerge-repo";
import { shortId } from "@automerge/keyhive-react";
import * as syncServer from "./syncServer";
import { log } from "./log";

/** The `#invite=` fragment prefix an invite link uses. */
const INVITE_HASH_PREFIX = "invite=";

/** How long to wait for the document's keyhive state to reach the invite identity. */
const DOC_SYNC_TIMEOUT_MS = 30_000;

/**
 * The budget the first attempt gets for the waits that happen before anything
 * is signed.
 */
const FIRST_ATTEMPT_SYNC_TIMEOUT_MS = 10_000;

/** How long to wait for the new delegation to come back to us before giving up on confirmation. */
const JOIN_CONFIRM_TIMEOUT_MS = 30_000;

const POLL_INTERVAL_MS = 250;

/** How many times to attempt a redemption before reporting failure. */
const REDEEM_ATTEMPTS = 3;

/** How long to wait before a fresh redemption attempt. */
const REDEEM_RETRY_DELAY_MS = 3_000;

/**
 * What a link carries. Versioned so a link created by an older build can be
 * rejected with a clear message.
 */
export interface InvitePayload {
  v: 1;
  /** The document being shared. */
  doc: AutomergeUrl;
  /** The access level the invite identity holds (via `Access.toString()`). */
  access: string;
  /** The invite identity's Ed25519 key pair, in the JWK form ARK stores. */
  key: { publicKey: JsonWebKey; privateKey: JsonWebKey };
  /** The invite identity's exported prekey secrets (base64). */
  prekeys: string;
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function encodePayload(payload: InvitePayload): string {
  const json = new TextEncoder().encode(JSON.stringify(payload));
  // base64url so the payload survives being pasted into a URL.
  return bytesToBase64(json)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

/** Parse an invite payload, returning null if it is not one we understand. */
function decodeInvite(encoded: string): InvitePayload | null {
  try {
    const base64 = encoded.replace(/-/g, "+").replace(/_/g, "/");
    const json = new TextDecoder().decode(base64ToBytes(base64));
    const payload = JSON.parse(json) as InvitePayload;
    if (payload.v !== 1) return null;
    if (!isValidAutomergeUrl(payload.doc)) return null;
    if (!payload.key?.privateKey || !payload.key?.publicKey) return null;
    if (typeof payload.prekeys !== "string") return null;
    // Throws on an unrecognized level, which decodeInvite reports as invalid.
    Access.fromString(payload.access);
    return payload;
  } catch {
    return null;
  }
}

/** Read an invite payload out of a location hash, if there is one. */
export function inviteFromHash(hash: string): InvitePayload | null {
  const withoutHash = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!withoutHash.startsWith(INVITE_HASH_PREFIX)) return null;
  return decodeInvite(withoutHash.slice(INVITE_HASH_PREFIX.length));
}

/** The keyhive document id behind an Automerge URL. */
function keyhiveDocId(docUrl: AutomergeUrl): KeyhiveDocumentId {
  const { binaryDocumentId } = parseAutomergeUrl(docUrl);
  return new KeyhiveDocumentId(binaryDocumentId);
}

async function exportKeyPair(
  keyPair: CryptoKeyPair
): Promise<InvitePayload["key"]> {
  return {
    publicKey: await crypto.subtle.exportKey("jwk", keyPair.publicKey),
    privateKey: await crypto.subtle.exportKey("jwk", keyPair.privateKey),
  };
}

async function importKeyPair(
  key: InvitePayload["key"]
): Promise<CryptoKeyPair> {
  return {
    publicKey: await crypto.subtle.importKey(
      "jwk",
      key.publicKey,
      "Ed25519",
      true,
      ["verify"]
    ),
    privateKey: await crypto.subtle.importKey(
      "jwk",
      key.privateKey,
      "Ed25519",
      true,
      ["sign"]
    ),
  };
}

/** Resolve once `check` returns a value, or throw `message` after `timeoutMs`. */
async function poll<T>(
  check: () => Promise<T | null | undefined>,
  timeoutMs: number,
  message: string
): Promise<T> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const result = await check();
    if (result != null) return result;
    if (Date.now() > deadline) throw new Error(message);
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }
}

/**
 * Wait until `repo` can actually read the document's content.
 *
 * The progress query has to be created once and then polled. Asking the repo
 * for a fresh query each time restarts it, so it never leaves "loading".
 *
 * The query's own `whenReady()` is deliberately not used. It rejects the moment
 * the query reports "unavailable", and that state is not terminal here. A
 * "failed" query is terminal, so that one is reported at once instead of
 * waiting out the timeout.
 */
async function waitUntilReadable(
  repo: Repo,
  docUrl: AutomergeUrl,
  timeoutMs: number,
  message: string
): Promise<void> {
  const query = repo.findWithProgress(docUrl);
  await poll(
    async () => {
      const state = query.peek();
      if (state.state === "failed") {
        throw new Error(message, { cause: state.error });
      }
      return state.state === "ready" ? true : null;
    },
    timeoutMs,
    message
  );
}

/**
 * Storage for the invite identity's short-lived hive. It exists for one join
 * and is thrown away with the page, so nothing it holds should outlive the tab
 * or end up in the visitor's own IndexedDB alongside their real identity.
 */
class MemoryStorageAdapter implements StorageAdapterInterface {
  #data = new Map<string, Uint8Array>();

  #stringify(key: StorageKey): string {
    return JSON.stringify(key);
  }

  async load(key: StorageKey): Promise<Uint8Array | undefined> {
    return this.#data.get(this.#stringify(key));
  }

  async save(key: StorageKey, data: Uint8Array): Promise<void> {
    this.#data.set(this.#stringify(key), data);
  }

  async remove(key: StorageKey): Promise<void> {
    this.#data.delete(this.#stringify(key));
  }

  async loadRange(keyPrefix: StorageKey): Promise<Chunk[]> {
    const chunks: Chunk[] = [];
    for (const [stringified, data] of this.#data) {
      const key = JSON.parse(stringified) as StorageKey;
      if (keyPrefix.every((part, i) => key[i] === part)) {
        chunks.push({ key, data });
      }
    }
    return chunks;
  }

  async removeRange(keyPrefix: StorageKey): Promise<void> {
    for (const stringified of [...this.#data.keys()]) {
      const key = JSON.parse(stringified) as StorageKey;
      if (keyPrefix.every((part, i) => key[i] === part)) {
        this.#data.delete(stringified);
      }
    }
  }

  async saveBatch(entries: Array<[StorageKey, Uint8Array]>): Promise<void> {
    for (const [key, data] of entries) await this.save(key, data);
  }
}

/** A link, plus who to revoke to turn it off. */
export interface InviteLink {
  /** The URL to share. */
  url: string;
  /** The invite identity's hex id, as the member list reports it. */
  memberId: string;
  /** The name published for that identity, so it can be named in the UI. */
  name: string;
}

/**
 * The name an invite identity goes by.
 */
function inviteLinkName(memberId: string): string {
  return `InviteLink: ${shortId(memberId)}`;
}

/**
 * Create a throwaway identity, give it `access` to the document, and return the
 * link that lets anyone act on its behalf.
 *
 * The caller must be able to grant `access`, which means holding at least that
 * level themselves.
 */
export async function createInviteLink(
  hive: AutomergeRepoKeyhive,
  docUrl: AutomergeUrl,
  access: Access
): Promise<InviteLink> {
  initKeyhiveWasm();

  const keyPair = (await crypto.subtle.generateKey({ name: "Ed25519" }, true, [
    "sign",
    "verify",
  ])) as CryptoKeyPair;

  // A bare keyhive, built only to produce the identity's contact card and its
  // prekey secrets. It never syncs and is dropped as soon as we have both.
  const inviteKeyhive = await Keyhive.init(
    await Signer.webCryptoSigner(keyPair),
    CiphertextStore.newInMemory(),
    () => {}
  );
  const contactCard = await inviteKeyhive.getExistingContactCard();
  const prekeys = await inviteKeyhive.exportPrekeySecrets();

  await hive.addMemberToDoc(docUrl, contactCard, access);

  const payload: InvitePayload = {
    v: 1,
    doc: docUrl,
    access: access.toString(),
    key: await exportKeyPair(keyPair),
    prekeys: bytesToBase64(prekeys),
  };

  const url = new URL(window.location.href);
  url.hash = `${INVITE_HASH_PREFIX}${encodePayload(payload)}`;

  const memberId = uint8ArrayToHex(contactCard.id.toBytes());
  return { url: url.toString(), memberId, name: inviteLinkName(memberId) };
}

/**
 * A failure from before the delegation was signed. Nothing was delegated and
 * the whole attempt can safely be made again with a fresh invite hive.
 */
class BeforeDelegationError extends Error {}

export interface RedeemOptions {
  /**
   * Called as each attempt begins, with the attempt number and how many there
   * will be.
   */
  onAttempt?: (attempt: number, of: number) => void;
}

/**
 * Act as the invite identity long enough to grant `myContactCard` the same
 * access, then drop it. Resolves with the document URL once this identity can
 * actually read the document.
 *
 * Retries the whole attempt, including hive initialization, while the failure
 * is still one that delegated nothing.
 */
export async function redeemInviteLink(
  hive: AutomergeRepoKeyhive,
  repo: Repo,
  payload: InvitePayload,
  myContactCard: ContactCard,
  options: RedeemOptions = {}
): Promise<AutomergeUrl> {
  for (let attempt = 1; attempt <= REDEEM_ATTEMPTS; attempt++) {
    options.onAttempt?.(attempt, REDEEM_ATTEMPTS);
    try {
      return await attemptRedeem(hive, repo, payload, myContactCard, attempt);
    } catch (error) {
      if (!(error instanceof BeforeDelegationError)) throw error;
      if (attempt >= REDEEM_ATTEMPTS) {
        // Callers have no use for BeforeDelegationError once we have stopped
        // retrying, but the original is worth keeping as the cause.
        throw new Error(error.message, { cause: error });
      }
      log.warn(
        `Invite attempt ${attempt} delegated nothing (${error.message}). Trying again with a fresh invite identity session.`
      );
      await new Promise((resolve) =>
        setTimeout(resolve, REDEEM_RETRY_DELAY_MS)
      );
    }
  }
  // Unreachable: the last attempt either returns or throws above.
  throw new Error("The invite link could not be redeemed.");
}

async function attemptRedeem(
  hive: AutomergeRepoKeyhive,
  repo: Repo,
  payload: InvitePayload,
  myContactCard: ContactCard,
  attempt: number
): Promise<AutomergeUrl> {
  const access = Access.fromString(payload.access);
  const docUrl = payload.doc;
  const storage = new MemoryStorageAdapter();
  const syncTimeoutMs =
    attempt === 1 ? FIRST_ATTEMPT_SYNC_TIMEOUT_MS : DOC_SYNC_TIMEOUT_MS;

  // A second hive, running as the invite identity, with its own repo and its
  // own connection to the sync server. It needs one because the delegation it
  // is about to sign has to be made against the document's current keyhive
  // state, which only a member can fetch.
  const { hive: inviteHive, repo: inviteRepo } =
    await initializeAutomergeRepoKeyhive({
      createRepo: (config) => new Repo(config),
      storage,
      peerIdSuffix: "keyhive-demo-invite",
      keyPair: await importKeyPair(payload.key),
      automaticArchiveIngestion: true,
      cachingMode: "periodic",
      syncServer: syncServer.SELECTION,
      repo: {
        storage,
        subductionWebsocketEndpoints: [syncServer.ENDPOINT],
      },
    });

  try {
    // The hive generated its own fresh prekeys on startup. The document was
    // shared with the ones in the link, so bring those in as well.
    await inviteHive.keyhive.importPrekeySecrets(
      base64ToBytes(payload.prekeys)
    );

    log.info("Waiting for the invited document to sync...");
    const docId = keyhiveDocId(docUrl);
    try {
      await poll(
        () => inviteHive.keyhive.getDocument(docId),
        syncTimeoutMs,
        "The invited document did not sync. The link may have been revoked."
      );

      // Wait for the content, not just the membership. Right after the add,
      // ARK gives the new member a derivable key by rotating the PCS key and
      // writing a nudge edit into the document, which means the invite hive's
      // repo has to be holding the document by then. Doing that fetch here keeps
      // it in front of the add, where a failure is still reportable.
      await waitUntilReadable(
        inviteRepo,
        docUrl,
        syncTimeoutMs,
        "The invited document synced but could not be read. The link may be stale."
      );
    } catch (error) {
      throw new BeforeDelegationError(
        error instanceof Error ? error.message : String(error)
      );
    }

    await inviteHive.addMemberToDoc(docUrl, myContactCard, access);
    log.info("Granted this identity access via the invite link.");

    const myIdHex = uint8ArrayToHex(hive.active.individual.id.toBytes());
    await poll(
      async () => {
        try {
          const members = await hive.listMembers(docUrl);
          return members.some((m) => m.id === myIdHex) || null;
        } catch {
          // The document is not in our own keyhive yet.
          return null;
        }
      },
      JOIN_CONFIRM_TIMEOUT_MS,
      "Joined, but the membership has not synced back yet. It may appear shortly."
    );

    // Membership alone leaves the new member with no derivable document key.
    // ARK fixes that from the adding side: a couple of seconds after the add it
    // rotates the PCS key and writes a nudge edit under the new key. That work
    // happens on the invite hive, so it has to stay open until this identity
    // can actually read the document, not merely until it is listed as a
    // member.
    await waitUntilReadable(
      repo,
      docUrl,
      JOIN_CONFIRM_TIMEOUT_MS,
      "Joined, but the list has not become readable yet. It may appear shortly."
    );

    return docUrl;
  } finally {
    inviteHive.close();
    await inviteRepo.shutdown();
  }
}
