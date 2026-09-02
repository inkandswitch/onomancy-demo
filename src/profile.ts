// Self-published profiles: your own name and avatar, in your own document.
//
// The phonebook is one shared unprotected map that everyone writes everyone's
// entries into, so anyone holding its id can rename anyone. Petnames fixed the
// half of that which is *your labels for other people*. This fixes the other
// half — *your own* name, which is an assertion you want others to read and so
// cannot simply be kept private.
//
// ## The discovery problem, and why a pointer is enough
//
// To read your profile I must know which document holds it. Putting that
// pointer in the shared phonebook makes it exactly as forgeable as the name
// was: an attacker rewrites your pointer to a document they control, and their
// profile answers for you.
//
// A forged pointer is *detectable*, though, which a forged name is not. The
// profile document is a keyhive document, and its admins are checkable. So:
//
//   trust this profile  <=>  the identity claiming it is an admin of the
//                            document it is published in
//
// A pointer to an attacker's document fails, because the victim's identity is
// not an admin there. A pointer to a document nobody administers fails. The
// pointer being forgeable stops mattering, in the same way the phonebook
// holding a forgeable DNS *claim* stopped mattering once the badge came from
// DNSSEC rather than from the document.
//
// This is the reverse-binding pattern one layer down: the shared map carries
// the claim, and the claimed document supplies the authority.

import { useEffect, useMemo, useState } from "react";
import type { AutomergeUrl, Repo } from "@automerge/react/slim";
import { isValidAutomergeUrl } from "@automerge/react/slim";
import type { AutomergeRepoKeyhive } from "@automerge/automerge-repo-keyhive";
import { documentDelegatesTo } from "@automerge/keyhive-react";
import type { DirectoryEntry, NameDirectory } from "@automerge/keyhive-react";
import { keyhiveRuntime } from "./keyhiveRuntime";
import { log } from "./log";
import type { NamestoreDoc } from "./namestore";

/**
 * Where a self-published profile lives in its owner's namestore.
 *
 * A sibling of the `onomancy` edge map and of `petnames`, for the same reason
 * both of those are siblings: a profile is neither a name-to-document edge nor
 * a label for somebody else.
 */
export const PROFILE_KEY = "profile";

export interface SelfProfile {
  name?: string;
  avatar?: Uint8Array | null;
}

type ProfileDoc = NamestoreDoc & { [PROFILE_KEY]?: SelfProfile };

function bareId(id: string): string {
  return (id.startsWith("0x") ? id.slice(2) : id).toLowerCase();
}

/** Publish your own name and avatar into your own namestore. */
export async function publishProfile(
  repo: Repo,
  namestoreUrl: AutomergeUrl,
  profile: SelfProfile
): Promise<void> {
  const handle = await repo.find<ProfileDoc>(namestoreUrl);
  handle.change((doc) => {
    // Assign then re-read: `??=` yields the plain object, not the proxy.
    if (!doc[PROFILE_KEY]) doc[PROFILE_KEY] = {};
    const held = doc[PROFILE_KEY];
    if (!held) return;
    if (profile.name !== undefined) held.name = profile.name;
    if (profile.avatar !== undefined) held.avatar = profile.avatar;
  });
}

export type ProfileVerdict =
  /** Published in a document this identity administers. Trustworthy. */
  | { status: "verified"; profile: SelfProfile }
  /** The pointer names a document this identity does not administer. */
  | { status: "impostor" }
  /** No pointer, no document, or not yet replicated. Says nothing. */
  | { status: "unknown" };

/**
 * Read `identityId`'s self-published profile from `namestoreUrl`, and check
 * that the identity actually speaks for that document.
 *
 * The check is `documentDelegatesTo` at admin — the same bar certificate
 * signing uses, and for the same reason: a collaborator with write access to
 * somebody's namestore could otherwise publish a profile *as* them.
 *
 * `unknown` for anything unproven, `impostor` only when the document is held
 * and the identity is demonstrably not among its admins. Absence of evidence
 * is not evidence of absence, here as everywhere else.
 *
 * `impostor` depends on `documentDelegatesTo` walking transitively. A held
 * document that reaches the identity by **no path** is positive evidence of
 * non-membership; absence from a *direct*-member list alone would not be,
 * since the identity might hold access through a nested group.
 *
 * The distinction has teeth: `useVerifiedProfiles` drops an entry it convicts,
 * where an unproven one merely fails to be upgraded. A forged pointer
 * disappears rather than degrading to its phonebook name.
 *
 * `unknown` means what it says: the document is not here to ask.
 */
export async function verifyProfile(
  repo: Repo,
  hive: AutomergeRepoKeyhive,
  identityId: string,
  namestoreUrl: string
): Promise<ProfileVerdict> {
  if (!isValidAutomergeUrl(namestoreUrl)) return { status: "unknown" };

  let profile: SelfProfile | undefined;
  try {
    const handle = await repo.find<ProfileDoc>(namestoreUrl as AutomergeUrl);
    profile = handle.doc()?.[PROFILE_KEY];
  } catch {
    // Not replicated here. Says nothing about the claim.
    return { status: "unknown" };
  }
  if (!profile) return { status: "unknown" };

  const documentId = bareId(
    [
      ...keyhiveRuntime
        .docIdFromAutomergeUrl(namestoreUrl as AutomergeUrl)
        .toBytes(),
    ]
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("")
  );

  try {
    const verdict = await documentDelegatesTo(
      keyhiveRuntime,
      hive,
      [documentId],
      bareId(identityId)
    );
    if (verdict === "delegates") return { status: "verified", profile };
    if (verdict === "insufficient") return { status: "impostor" };
    return { status: "unknown" };
  } catch (error) {
    log.debug(
      `profile: could not check ${identityId} against ${namestoreUrl}:`,
      error
    );
    return { status: "unknown" };
  }
}

/**
 * `base`, with self-published profiles preferred over the shared map.
 *
 * The trust ladder, weakest first:
 *
 * | Source | Who can write it | Beats |
 * | --- | --- | --- |
 * | phonebook entry | anyone holding the phonebook id | nothing |
 * | verified self-profile | only the identity itself | the phonebook |
 * | your petname | only you | everything |
 *
 * Each rung is authored by someone with more right to it than the rung below.
 * Your label for someone wins outright, because a petname is what *you* call
 * them and no assertion of theirs should override it.
 *
 * A profile that fails its check does not merely lose — it is dropped, and the
 * phonebook entry is dropped with it. An entry claiming a document it cannot
 * speak for has demonstrated bad faith about the one thing here that is
 * checkable, so its unverifiable fields do not deserve a fallback.
 */
export function useVerifiedProfiles(
  repo: Repo,
  hive: AutomergeRepoKeyhive,
  base: NameDirectory,
  pointers: Record<string, string>
): NameDirectory {
  const [verdicts, setVerdicts] = useState<Record<string, ProfileVerdict>>({});

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const next: Record<string, ProfileVerdict> = {};
      for (const [id, namestore] of Object.entries(pointers)) {
        next[bareId(id)] = await verifyProfile(repo, hive, id, namestore);
      }
      if (!cancelled) setVerdicts(next);
    })();
    return () => {
      cancelled = true;
    };
  }, [repo, hive, pointers]);

  return useMemo(() => {
    const decorate = (entry: DirectoryEntry): DirectoryEntry | undefined => {
      const verdict = verdicts[bareId(entry.id)];
      if (!verdict || verdict.status === "unknown") return entry;
      if (verdict.status === "impostor") return undefined;
      return {
        ...entry,
        ...(verdict.profile.name !== undefined
          ? { name: verdict.profile.name }
          : {}),
        ...(verdict.profile.avatar !== undefined
          ? { avatar: verdict.profile.avatar }
          : {}),
      };
    };

    return {
      source: `profiles+${base.source}`,
      trust: base.trust,
      writable: base.writable,
      enumerable: base.enumerable,
      notice: base.notice,
      lookup: (id) => {
        const entry = base.lookup(id);
        return entry ? decorate(entry) : undefined;
      },
      list: () =>
        base.list().flatMap((entry) => {
          const decorated = decorate(entry);
          return decorated ? [decorated] : [];
        }),
      subscribe: base.subscribe?.bind(base),
      publish: base.publish?.bind(base),
    };
  }, [base, verdicts]);
}
