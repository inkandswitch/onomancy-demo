import { useMemo } from "react";
import {
  createAutomergeDocDirectory,
  type AutomergeDocDirectoryOptions,
  type DirectoryDoc,
  type DirectoryDocChange,
} from "./automerge-directory";
import type { NameDirectory } from "./types";

/**
 * `createAutomergeDocDirectory` memoized on the document, so the directory
 * identity changes when the document does.
 */
export function useAutomergeDocDirectory(
  doc: DirectoryDoc | undefined,
  change: DirectoryDocChange | undefined,
  options: AutomergeDocDirectoryOptions = {}
): NameDirectory {
  const { source, trust, notice } = options;
  return useMemo(
    () => createAutomergeDocDirectory(doc, change, { source, trust, notice }),
    [doc, change, source, trust, notice]
  );
}
