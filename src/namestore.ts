// The namestore: the document this identity's names are written into.
//
// A namestore is an ordinary keyhive document holding a flat map of path to
// document reference under one reserved key. Two properties make it the right
// home for names, and neither of the demo's other documents has both:
//
//   - It is created through ARK, so its id is a self-certifying ed25519
//     verifying key. Onomancy rejects anything else as a doc anchor ("legacy
//     Automerge document ID — not self-certifying"), which rules out the
//     phonebook, whose id comes from gen:phonebook-id.
//   - It is access-controlled, so "who may bind a name here" is a keyhive
//     question with a real answer. The phonebook's answer is "anyone holding
//     its id", and the root document's is "nobody else, ever".
//
// It is also what a domain binds. The TXT record's p= field names this
// document, so whoever holds admin on it speaks for the domain. Ownership is
// shared by inviting more admins rather than by editing DNS.

import { AutomergeUrl, Repo, isValidAutomergeUrl } from "@automerge/react/slim";
import {
  AutomergeRepoKeyhive,
  uint8ArrayToHex,
} from "@automerge/automerge-repo-keyhive";
import { useEffect, useState } from "react";
import { errorMessage, log } from "./log";
import type { NamestoreEdges } from "./walk";

/**
 * The reserved top-level key namestore edges live under.
 *
 * Reserving one key lets a namestore share a document with other data without
 * colliding, which is what makes "the document a domain binds" and "the
 * document names live in" able to be the same document.
 */
export const RESERVED_ONOMANCY_KEY = "onomancy";

export type { NamestoreEdges } from "./walk";

export type NamestoreDoc = {
  [RESERVED_ONOMANCY_KEY]?: NamestoreEdges;
};

/** Where a namestore url came from, which decides whether it may be discarded. */
type Origin = "auto" | "loaded";

function urlKey(identityHex: string): string {
  return `keyhive-demo-namestore-${identityHex}`;
}

function originKey(identityHex: string): string {
  return `keyhive-demo-namestore-origin-${identityHex}`;
}

function storedUrl(identityHex: string): AutomergeUrl | null {
  const raw = localStorage.getItem(urlKey(identityHex));
  return raw && isValidAutomergeUrl(raw) ? raw : null;
}

function remember(
  identityHex: string,
  url: AutomergeUrl,
  origin: Origin
): void {
  localStorage.setItem(urlKey(identityHex), url);
  localStorage.setItem(originKey(identityHex), origin);
}

export interface Namestore {
  /** Null until the document has been created or read back from storage. */
  url: AutomergeUrl | null;
  /** Adopt a namestore another device or identity shared. */
  load: (url: AutomergeUrl) => void;
  error: string | null;
}

/**
 * This identity's namestore, created on first use.
 *
 * Created with `repo.create2` so it is a keyhive document like the task lists,
 * and granted sync server relay access so it reaches other devices. It is
 * seeded with the reserved map rather than left empty because a document with
 * no content never reaches the ready state in the current stack.
 */
export function useNamestore(
  repo: Repo,
  hive: AutomergeRepoKeyhive
): Namestore {
  const identityHex = uint8ArrayToHex(hive.active.individual.id.toBytes());
  const [url, setUrl] = useState<AutomergeUrl | null>(() =>
    storedUrl(identityHex)
  );
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // A different identity has a different namestore.
    setUrl(storedUrl(identityHex));
  }, [identityHex]);

  useEffect(() => {
    if (url) return;
    let cancelled = false;

    void (async () => {
      try {
        const handle = await repo.create2<NamestoreDoc>({
          [RESERVED_ONOMANCY_KEY]: {},
        });
        // Relay access so the sync server can move its ciphertext, exactly as
        // a new task list gets in DocumentList.
        await hive.addSyncServerRelayToDoc(handle.url);
        if (cancelled) return;
        remember(identityHex, handle.url, "auto");
        setUrl(handle.url);
      } catch (err) {
        log.error("Could not create the namestore:", err);
        if (!cancelled) {
          setError(`Could not create the namestore: ${errorMessage(err)}`);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [url, repo, hive, identityHex]);

  return {
    url,
    error,
    load: (loaded: AutomergeUrl) => {
      remember(identityHex, loaded, "loaded");
      setUrl(loaded);
      setError(null);
    },
  };
}

/**
 * How long to wait for one hop before calling it unavailable.
 *
 * `repo.find` does not fail fast for a document this device is *permitted* to
 * read but has not received: it waits, indefinitely, for a replica that may
 * never arrive. Observed against a real DNS-designated namestore that had been
 * granted public read — before the grant `find` rejected promptly with
 * "Document is unavailable", after it the same call was still pending at 60
 * seconds. Without a bound, one such hop hangs the whole walk and the UI sits
 * on "Resolving..." forever.
 *
 * A walk that gives up is reporting `unsynced`, which is exactly true: no
 * replica arrived in the time allowed. It is not a claim that none exists.
 */
const HOP_TIMEOUT_MS = 10_000;

/**
 * The namestore edges of one document, or `undefined` when this device does
 * not hold it.
 *
 * The distinction matters: no edges is an answer ("nothing is bound here"),
 * while an unheld document is the absence of one, and the walk reports them
 * differently.
 */
export async function edgesOf(
  repo: Repo,
  url: AutomergeUrl
): Promise<NamestoreEdges | undefined> {
  let doc: unknown;
  const abort = new AbortController();
  const giveUp = setTimeout(
    () => abort.abort(new Error("hop timed out")),
    HOP_TIMEOUT_MS
  );
  try {
    // The signal cancels the wait, not the load: a replica that arrives later
    // is still kept, so retrying the same name can succeed.
    const handle = await repo.find<NamestoreDoc>(url, { signal: abort.signal });
    doc = handle.doc();
  } catch {
    return undefined;
  } finally {
    clearTimeout(giveUp);
  }
  if (typeof doc !== "object" || doc === null) return undefined;

  const map = (doc as Record<string, unknown>)[RESERVED_ONOMANCY_KEY];
  if (typeof map !== "object" || map === null) return {};

  // Bare document references only. Anything else is absent rather than an
  // error, so one malformed edge cannot deny the rest of the namestore.
  const edges: NamestoreEdges = {};
  for (const [path, target] of Object.entries(map)) {
    if (typeof target === "string" && isValidAutomergeUrl(target)) {
      edges[path] = target;
    }
  }
  return edges;
}

/**
 * Write one edge into a namestore.
 *
 * Which namestore is the caller's decision, and it is the anchor of the name
 * being bound that decides: `~` writes here, `@host` writes into whatever
 * document that domain designates, `automerge:` writes into that document.
 * Once the anchor has picked the document the write is identical, which is the
 * same symmetry the walk has.
 */
export async function bindEdge(
  repo: Repo,
  namestoreUrl: AutomergeUrl,
  path: string,
  target: AutomergeUrl
): Promise<void> {
  const handle = await repo.find<NamestoreDoc>(namestoreUrl);
  handle.change((doc) => {
    const edges = (doc[RESERVED_ONOMANCY_KEY] ??= {});
    edges[path] = target;
  });
}

/** Remove one edge, which is how a name is unbound. */
export async function unbindEdge(
  repo: Repo,
  namestoreUrl: AutomergeUrl,
  path: string
): Promise<void> {
  const handle = await repo.find<NamestoreDoc>(namestoreUrl);
  handle.change((doc) => {
    const edges = doc[RESERVED_ONOMANCY_KEY];
    if (edges) delete edges[path];
  });
}
