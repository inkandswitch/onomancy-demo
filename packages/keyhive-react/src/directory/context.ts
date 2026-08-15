import { createContext, useContext } from "react";
import {
  emptyDirectory,
  type DirectoryEntry,
  type NameDirectory,
} from "./types";

export interface DirectoryContextValue {
  directory: NameDirectory;
  /** Bumped by the provider when the directory notifies a change. */
  version: number;
}

export const DirectoryContext = createContext<DirectoryContextValue>({
  directory: emptyDirectory,
  version: 0,
});

/** The directory in scope. Empty outside a provider. */
export function useDirectory(): NameDirectory {
  return useContext(DirectoryContext).directory;
}

export function useDirectoryEntry(
  id: string | undefined
): DirectoryEntry | undefined {
  const { directory } = useContext(DirectoryContext);
  return id ? directory.lookup(id) : undefined;
}

export function useDirectoryEntries(): DirectoryEntry[] {
  const { directory } = useContext(DirectoryContext);
  return directory.list();
}

/** An id abbreviated for display, used wherever a peer has no name. */
export function shortId(id: string, digits = 12): string {
  const bare = id.startsWith("0x") ? id.slice(2) : id;
  return bare.length <= digits ? `0x${bare}` : `0x${bare.slice(0, digits)}...`;
}

/** The directory's name for `id`, or `fallback`, or an abbreviated id. */
export function useDisplayName(id: string, fallback?: string): string {
  const entry = useDirectoryEntry(id);
  return entry?.name || fallback || shortId(id);
}
