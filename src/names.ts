// Resolving a name to a document.
//
// The walk itself lives in walk.ts, pure and substrate-free. This module binds
// it to the demo's substrate: automerge-repo for reading documents, onomancy
// for the DNS anchor.

import type { AutomergeUrl, Repo } from "@automerge/react/slim";
import { edgesOf } from "./namestore";
import { resolveBoundDocuments, type ParsedName } from "./onomancy";
import { walk, type Resolution } from "./walk";

export type {
  EdgeLookup,
  NamestoreEdges,
  PartialReason,
  Resolution,
} from "./walk";

/** Walk `segments` from `root` over the documents this repo holds. */
export async function resolvePath(
  repo: Repo,
  root: AutomergeUrl,
  segments: string[]
): Promise<Resolution> {
  return walk((url) => edgesOf(repo, url), root, segments);
}

/**
 * Resolve a parsed name.
 *
 * The anchor decides only where the walk starts, and how much the answer is
 * worth: a `~` name is trustworthy because it started from a document we hold,
 * a `@host` name because a DNSSEC chain from the IANA root said where to
 * start. After that the three are the same walk.
 *
 * `localRoot` is this identity's namestore, needed only for `~` names.
 */
export async function resolveName(
  repo: Repo,
  name: ParsedName,
  localRoot: AutomergeUrl | null
): Promise<Resolution> {
  return resolvePath(repo, await rootOf(name, localRoot), name.segments);
}

/**
 * The document a name's anchor starts from.
 *
 * Throws rather than returning a partial: a name whose anchor cannot be
 * established has not begun to resolve, which is a different thing from a walk
 * that got part way and can report how far it got.
 */
export async function rootOf(
  name: ParsedName,
  localRoot: AutomergeUrl | null
): Promise<AutomergeUrl> {
  switch (name.anchor.kind) {
    case "local":
      if (!localRoot) {
        throw new Error("This identity has no namestore yet.");
      }
      return localRoot;

    case "doc":
      return name.anchor.url;

    case "dns": {
      const { hostname } = name.anchor;
      const bound = await resolveBoundDocuments(hostname);
      // More than one during a migration's dual-publish window. The first is
      // the one to walk; the rest are the same namespace by another id.
      const [root] = bound;
      if (root === undefined) {
        throw new Error(
          `${hostname} publishes no usable onomancy binding. It needs a DNSSEC-signed _onomancy TXT record.`
        );
      }
      return root;
    }
  }
}

/** How far a partial walk got, in words a reader can act on. */
export function describePartial(
  resolution: Extract<Resolution, { status: "partial" }>
): string {
  const { consumed, total, reason } = resolution;
  const got =
    consumed === 0
      ? "No part of that name resolved"
      : `Only ${consumed} of ${total} segment${total === 1 ? "" : "s"} resolved`;

  return reason === "unsynced"
    ? `${got}: the next document has not synced to this device yet, so the rest of the name cannot be read. This is not evidence that the name is unbound.`
    : `${got}: the document it stopped at has no edge for what remains, so nothing is bound there.`;
}
