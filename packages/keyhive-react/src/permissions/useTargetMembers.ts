import { useCallback, useEffect, useState } from "react";
import type { PermissionTarget, TargetMember } from "./targets";

export interface TargetMembersState {
  members: TargetMember[];
  isLoading: boolean;
  error: string | null;
  refresh: () => void;
}

/** The members of a target, re-read whenever `refreshToken` changes. */
export function useTargetMembers(
  target: PermissionTarget,
  refreshToken: number = 0,
  enabled: boolean = true
): TargetMembersState {
  const [members, setMembers] = useState<TargetMember[]>([]);
  const [isLoading, setIsLoading] = useState(enabled);
  const [error, setError] = useState<string | null>(null);
  const [manualRefresh, setManualRefresh] = useState(0);

  const targetKey = target.key;

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    setIsLoading(true);

    void (async () => {
      try {
        const list = await target.listMembers();
        if (cancelled) return;
        setMembers(list);
        setError(null);
      } catch (err) {
        if (cancelled) return;
        setMembers([]);
        setError(
          err instanceof Error ? err.message : "Could not read the member list."
        );
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
    // Keyed on target.key. Callers rebuild the target on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetKey, refreshToken, manualRefresh, enabled]);

  const refresh = useCallback(() => setManualRefresh((n) => n + 1), []);

  return { members, isLoading, error, refresh };
}
