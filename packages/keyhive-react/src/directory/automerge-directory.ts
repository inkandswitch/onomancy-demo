import type { DirectoryEntry, DirectoryTrust, NameDirectory } from "./types";

/** Hex-encoded keyhive id to display information. */
export type DirectoryDoc = Record<
  string,
  {
    peerId?: string;
    name?: string;
    avatar?: Uint8Array | null;
  }
>;

/** The `changeDoc` half of `useDocument`. */
export type DirectoryDocChange = (updater: (doc: DirectoryDoc) => void) => void;

export interface AutomergeDocDirectoryOptions {
  source?: string;
  trust?: DirectoryTrust;
  notice?: string;
}

const DEFAULT_NOTICE =
  "Names come from a shared document that anyone with its id can edit. They are not verified.";

/**
 * A directory backed by a single Automerge document, where each peer writes its
 * own entry. Build it with `useAutomergeDocDirectory`.
 */
export function createAutomergeDocDirectory(
  doc: DirectoryDoc | undefined,
  change: DirectoryDocChange | undefined,
  options: AutomergeDocDirectoryOptions = {}
): NameDirectory {
  const directory: NameDirectory = {
    source: options.source ?? "automerge-doc",
    // An unsigned document is only as trustworthy as everyone who can write it.
    trust: options.trust ?? "unverified",
    writable: change !== undefined,
    enumerable: true,
    notice: options.notice ?? DEFAULT_NOTICE,

    lookup(id) {
      const record = doc?.[id];
      return record ? { id, ...record } : undefined;
    },

    list() {
      if (!doc) return [];
      return Object.entries(doc).map(([id, record]) => ({ id, ...record }));
    },
  };

  if (change) {
    directory.publish = (entry: DirectoryEntry) => {
      change((d) => {
        const existing = d[entry.id];
        if (!existing) {
          // Assigning undefined into an Automerge document throws.
          const record: DirectoryDoc[string] = {};
          if (entry.peerId !== undefined) record.peerId = entry.peerId;
          if (entry.name !== undefined) record.name = entry.name;
          if (entry.avatar !== undefined) record.avatar = entry.avatar ?? null;
          d[entry.id] = record;
          return;
        }
        // Field by field, so concurrent writes merge.
        if (entry.peerId !== undefined) existing.peerId = entry.peerId;
        if (entry.name !== undefined) existing.name = entry.name;
        if (entry.avatar !== undefined) existing.avatar = entry.avatar ?? null;
      });
    };
  }

  return directory;
}
