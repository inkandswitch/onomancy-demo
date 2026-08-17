import { useCallback, useEffect, useState } from "react";
import type { Access } from "@automerge/automerge-repo-keyhive";
import type { PermissionTarget, TargetMember } from "./targets";

export interface TargetMembersState {
  /** One entry per direct delegation. */
  members: TargetMember[];
  /**
   * This identity's effective access, including access held through a group,
   * which has no entry in `members`.
   */
  selfAccess: Access | undefined;
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
  const [selfAccess, setSelfAccess] = useState<Access | undefined>(undefined);
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
        const [list, mine] = await Promise.all([
          target.listMembers(),
          target.selfAccess(),
        ]);
        if (cancelled) return;
        setMembers(list);
        setSelfAccess(mine);
        setError(null);
      } catch (err) {
        if (cancelled) return;
        setMembers([]);
        setSelfAccess(undefined);
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

  return { members, selfAccess, isLoading, error, refresh };
}
