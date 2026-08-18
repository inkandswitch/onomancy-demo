import { useEffect, useState } from "react";
import type { AutomergeRepoKeyhive } from "@automerge/automerge-repo-keyhive";

// Keyhive emits a burst of events for one logical change, so coalesce them.
const KEYHIVE_UPDATE_DEBOUNCE_MS = 100;

/**
 * A counter that increments whenever keyhive state changes.
 *
 * Access and membership queries are async and have no change notification of
 * their own, so components re-run them when this counter moves. Subscribe once
 * near the top of an app and pass the counter down.
 */
export function useKeyhiveUpdates(hive: AutomergeRepoKeyhive): number {
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    const handler = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        setVersion((v) => v + 1);
      }, KEYHIVE_UPDATE_DEBOUNCE_MS);
    };

    // The emitter covers local changes, the adapter covers remote ones.
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
