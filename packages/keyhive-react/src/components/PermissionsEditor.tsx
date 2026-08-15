import { useEffect, useMemo, useState } from "react";
import {
  Access,
  ContactCard,
  type AutomergeRepoKeyhiveBase,
  type DocMember,
} from "@automerge/automerge-repo-keyhive";
import type { AutomergeUrl } from "@automerge/react/slim";
import { shortId, type ContactMap } from "../contacts";
import { AccessBadge } from "./primitives/AccessBadge";
import { Avatar } from "./primitives/Avatar";

export interface PermissionsEditorProps {
  hive: AutomergeRepoKeyhiveBase;
  docUrl: AutomergeUrl;
  contacts: ContactMap | undefined;
  /**
   * Counter that triggers a re-read of the member list. Pass the value from
   * `useKeyhiveUpdates`.
   */
  refreshToken?: number;
  /** Set false to stop loading, for example while a dialog is closed. */
  enabled?: boolean;
  /** Label for a member no contact entry covers, such as a sync server. */
  labelForMember?: (member: DocMember) => string | undefined;
  showPublicAccess?: boolean;
  /** The level "Make Public" grants. Default `"edit"`. */
  publicAccessLevel?: "relay" | "read" | "edit" | "admin";
  fallbackAvatarSrc?: string;
  className?: string;
}

function memberLabel(
  member: DocMember,
  contacts: ContactMap | undefined,
  labelForMember?: (member: DocMember) => string | undefined
): string {
  if (member.isPublic) return "Public";
  return (
    contacts?.[member.id]?.name ??
    labelForMember?.(member) ??
    shortId(member.id)
  );
}

/**
 * Add and remove members on a keyhive document at a chosen access level.
 *
 * You can only delegate at levels at or below your own access levels. And only
 * an admin can revoke members.
 */
export function PermissionsEditor({
  hive,
  docUrl,
  contacts,
  refreshToken = 0,
  enabled = true,
  labelForMember,
  showPublicAccess = true,
  publicAccessLevel = "edit",
  fallbackAvatarSrc,
  className = "",
}: PermissionsEditorProps) {
  const [members, setMembers] = useState<DocMember[]>([]);
  const [isLoading, setIsLoading] = useState(enabled);
  const [contactCardInput, setContactCardInput] = useState("");
  const [selectedLevel, setSelectedLevel] = useState("Edit");
  const [error, setError] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    setIsLoading(true);

    void (async () => {
      try {
        const list = await hive.listMembers(docUrl);
        if (!cancelled) {
          setMembers(list);
          setError(null);
        }
      } catch (err) {
        if (!cancelled) {
          setMembers([]);
          setError(
            err instanceof Error ? err.message : "Could not read the members."
          );
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [hive, docUrl, refreshToken, reload, enabled]);

  const myAccess = members.find((m) => m.isSelf)?.access;
  const publicMember = members.find((m) => m.isPublic);
  const currentPublicAccess = publicMember?.access.toString();

  const adminAccess = useMemo(() => Access.admin(), []);
  const isAdmin = myAccess?.atLeast(adminAccess) ?? false;
  const canDelegate = myAccess?.isReader ?? false;

  // You can grant your own level or anything below it.
  const delegationOptions = useMemo(() => {
    if (!myAccess) return [];
    return [Access.relay(), Access.read(), Access.edit(), Access.admin()]
      .filter((level) => myAccess.atLeast(level))
      .map((level) => level.toString());
  }, [myAccess]);

  useEffect(() => {
    if (delegationOptions.length > 0 && !delegationOptions.includes(selectedLevel)) {
      setSelectedLevel(delegationOptions[delegationOptions.length - 1]);
    }
  }, [delegationOptions, selectedLevel]);

  const sortedMembers = useMemo(
    () =>
      [...members].sort((a, b) =>
        memberLabel(a, contacts, labelForMember).localeCompare(
          memberLabel(b, contacts, labelForMember)
        )
      ),
    [members, contacts, labelForMember]
  );

  const run = async (taskDescription: string, task: () => Promise<void>) => {
    setError(null);
    setIsBusy(true);
    try {
      await task();
      // Keyhive will also fire an update, but a local action should show its
      // result without waiting for the debounce.
      setReload((n) => n + 1);
    } catch (err) {
      setError(`Could not ${taskDescription}: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsBusy(false);
    }
  };

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    const json = contactCardInput.trim();
    if (!json) return;

    void run("share document", async () => {
      const contactCard = ContactCard.fromJson(json);
      if (!contactCard) throw new Error("Not a valid contact card");
      // Throws on an unrecognized access level.
      const access = Access.fromString(selectedLevel);
      await hive.addMemberToDoc(docUrl, contactCard, access);
      setContactCardInput("");
    });
  };

  return (
    <div className={className}>
      {canDelegate && (
        <form onSubmit={handleAdd} className="mb-6">
          <div className="flex gap-2">
            <input
              type="text"
              value={contactCardInput}
              onChange={(e) => setContactCardInput(e.target.value)}
              placeholder="Contact Card"
              aria-label="Contact card"
              className="flex-1 px-3 py-2 border border-border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-ring focus:border-ring text-sm bg-background text-foreground"
            />
            <select
              value={selectedLevel}
              onChange={(e) => setSelectedLevel(e.target.value)}
              aria-label="Access level"
              className="px-3 py-2 border border-border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-ring focus:border-ring text-sm bg-background text-foreground"
            >
              {delegationOptions.map((level) => (
                <option key={level} value={level}>
                  {level.toUpperCase()}
                </option>
              ))}
            </select>
            <button
              type="submit"
              disabled={isBusy}
              className="px-4 py-2 bg-secondary text-secondary-foreground text-sm font-medium rounded-md hover:bg-accent focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-ring transition-colors border border-border disabled:opacity-50"
            >
              Add
            </button>
          </div>
        </form>
      )}

      {error && (
        <p role="alert" className="mb-4 text-sm text-destructive">
          {error}
        </p>
      )}

      {showPublicAccess && (
        <div className="mb-6 flex items-center justify-between gap-3">
          <p className="text-sm text-foreground">
            {currentPublicAccess ? (
              <>
                This document is <span className="font-medium">public</span> (
                {currentPublicAccess.toUpperCase()})
              </>
            ) : (
              <>
                This document is <span className="font-medium">private</span>
              </>
            )}
          </p>
          {isAdmin &&
            (currentPublicAccess ? (
              <button
                onClick={() =>
                  // Making a document private revokes the public member.
                  void run("make document private", async () => {
                    if (publicMember) {
                      await hive.revokeMemberFromDoc(docUrl, publicMember.id);
                    }
                  })
                }
                disabled={isBusy}
                className="px-4 py-2 bg-secondary text-secondary-foreground text-sm font-medium rounded-md hover:bg-accent focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-ring transition-colors border border-border disabled:opacity-50"
              >
                Make Private
              </button>
            ) : (
              <button
                onClick={() =>
                  void run("make document public", () =>
                    hive.setPublicAccess(
                      docUrl,
                      Access.fromString(publicAccessLevel)
                    )
                  )
                }
                disabled={isBusy}
                className="px-4 py-2 bg-secondary text-secondary-foreground text-sm font-medium rounded-md hover:bg-accent focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-ring transition-colors border border-border disabled:opacity-50"
              >
                Make Public
              </button>
            ))}
        </div>
      )}

      <hr className="border-border mb-6" />

      <div>
        <h3 className="text-sm font-medium text-foreground mb-4">
          Current Access
        </h3>
        <div className="space-y-3">
          {isLoading ? (
            <p className="text-sm text-muted-foreground italic">Loading...</p>
          ) : members.length === 0 ? (
            <p className="text-sm text-muted-foreground italic">
              No users have access yet
            </p>
          ) : (
            sortedMembers.map((member) => {
              const label = memberLabel(member, contacts, labelForMember);
              return (
                <div
                  key={member.id}
                  className="flex items-center justify-between gap-2 py-2 px-3 bg-muted rounded-md"
                >
                  <div className="flex items-center space-x-3 min-w-0">
                    <Avatar
                      avatar={contacts?.[member.id]?.avatar}
                      name={label}
                      fallbackSrc={fallbackAvatarSrc}
                    />
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-foreground truncate">
                        {label}
                      </div>
                      <AccessBadge access={member.access.toString()} />
                    </div>
                  </div>
                  {isAdmin && !member.isSelf && !member.isSyncServer && (
                    <button
                      type="button"
                      onClick={() =>
                        void run("remove member", () =>
                          hive.revokeMemberFromDoc(docUrl, member.id)
                        )
                      }
                      disabled={isBusy}
                      className="text-muted-foreground hover:text-destructive transition-colors p-1 disabled:opacity-50 shrink-0"
                      aria-label={`Remove ${label}`}
                    >
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M6 18L18 6M6 6l12 12"
                        />
                      </svg>
                    </button>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
