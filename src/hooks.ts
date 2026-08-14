import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { AutomergeUrl, useRepo } from "@automerge/react/slim";
import { AutomergeRepoKeyhive } from "@automerge/automerge-repo-keyhive";

/**
 * Re-render the calling component as a document's availability changes.
 *
 * A repo's live query for a document moves through loading / unavailable /
 * ready. Opening a document you have not been granted access to yet leaves
 * the query unavailable. When keyhive access changes, ARK calls
 * `repo.shareConfigChanged()`, which transitions the query back to ready
 * and fires this subscription.
 */
export function useReRenderOnDocProgress(docUrl: AutomergeUrl): void {
  const repo = useRepo();
  const query = useMemo(() => repo.findWithProgress(docUrl), [repo, docUrl]);
  useSyncExternalStore(
    (onChange) => query.subscribe(onChange),
    () => query.peek().state
  );
}

// Keyhive can emit a burst of events for one logical change (a new delegation
// rotates keys and writes a nudge edit, for example). Coalesce them so the access
// queries they trigger run once.
const KEYHIVE_UPDATE_DEBOUNCE_MS = 100;

/**
 * A counter that increments whenever keyhive state changes.
 *
 * `emitter.on("update")` covers changes this peer makes itself, while
 * `ingest-remote` on the network adapter covers changes from remote peers.
 */
export function useKeyhiveUpdates(hive: AutomergeRepoKeyhive): number {
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let timeoutId: number;
    const handler = () => {
      clearTimeout(timeoutId);
      timeoutId = window.setTimeout(() => {
        setVersion((v) => v + 1);
      }, KEYHIVE_UPDATE_DEBOUNCE_MS);
    };

    hive.emitter.on("update", handler);
    hive.networkAdapter.on("ingest-remote", handler);
    return () => {
      clearTimeout(timeoutId);
      hive.emitter.off("update", handler);
      hive.networkAdapter.off("ingest-remote", handler);
    };
  }, [hive]);

  return version;
}
