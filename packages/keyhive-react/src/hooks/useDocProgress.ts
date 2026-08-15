import { useMemo, useSyncExternalStore } from "react";
import type { AutomergeUrl, Repo } from "@automerge/react/slim";

/**
 * Re-render when a document's keyhive access level changes, so a newly delegated document
 * appears without a reload. Pass `useRepo()` from the application.
 */
export function useReRenderOnDocProgress(
  repo: Repo,
  docUrl: AutomergeUrl
): void {
  const query = useMemo(() => repo.findWithProgress(docUrl), [repo, docUrl]);
  useSyncExternalStore(
    (onChange) => query.subscribe(onChange),
    () => query.peek().state
  );
}
