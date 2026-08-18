/** Whether a directory's names are self-asserted or proven. */
export type DirectoryTrust = "unverified" | "verified";

/** What an entry's id refers to. Groups are named here like individuals are. */
export type DirectoryEntryKind = "individual" | "group";

/** Display information for one keyhive identity. */
export interface DirectoryEntry {
  /** Hex-encoded keyhive identifier, as `listMembers` returns it. */
  id: string;
  name?: string;
  avatar?: Uint8Array | null;
  peerId?: string;
  /** Absent in entries written before directories recorded it. */
  kind?: DirectoryEntryKind;
  /**
   * JSON contact card, so someone found by name can be granted access without
   * needing to paste one in. Individuals only since a group has no card.
   */
  contactCard?: string;
}

export interface NameDirectory {
  /** Short identifier for the implementation, for example `"phonebook"`. */
  readonly source: string;
  readonly trust: DirectoryTrust;
  /** False when `publish` is absent. */
  readonly writable: boolean;
  /** False when entries can only be looked up by id, not listed. */
  readonly enumerable: boolean;
  /** One sentence about this directory's limits, rendered by the components. */
  readonly notice?: string;

  /** Synchronous, because it runs during render. */
  lookup(id: string): DirectoryEntry | undefined;

  /** Empty when `enumerable` is false. */
  list(): DirectoryEntry[];

  /** Present only when `writable`. */
  publish?(entry: DirectoryEntry): Promise<void> | void;

  /** Optional. For directories whose contents live outside React. */
  subscribe?(listener: () => void): () => void;
}

/** A directory that knows nothing. */
export const emptyDirectory: NameDirectory = {
  source: "empty",
  trust: "unverified",
  writable: false,
  enumerable: true,
  lookup: () => undefined,
  list: () => [],
};
