import { useMemo } from "react";
import type { AutomergeRepoKeyhiveBase } from "@automerge/automerge-repo-keyhive";
import type { PeerId } from "@automerge/react/slim";
import { bytesToHex, peerIdWithoutSuffix } from "../bytes";

/** Either hive. `peerId` is on the concrete hives, not on the base. */
export type KeyhiveHive = AutomergeRepoKeyhiveBase & {
  readonly peerId: PeerId;
};

export interface SelfIdentity {
  /** Hex-encoded keyhive identifier, the id members are listed under. */
  id: string;
  /** Peer id without its per-session suffix, stable for the life of the key. */
  peerId: string;
  contactCardJson: string;
}

/** The local identity's ids and contact card. */
export function useSelfIdentity(hive: KeyhiveHive): SelfIdentity {
  // Each of these is a WASM call and none of them change for the life of the
  // identity.
  return useMemo(
    () => ({
      id: bytesToHex(hive.active.individual.id.toBytes()),
      peerId: peerIdWithoutSuffix(hive.peerId),
      contactCardJson: hive.active.contactCard.toJson(),
    }),
    [hive]
  );
}
