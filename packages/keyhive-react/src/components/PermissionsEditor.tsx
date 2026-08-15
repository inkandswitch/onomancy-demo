import { useEffect, useMemo, useState } from "react";
import type {
  AutomergeRepoKeyhiveBase,
  DocMember,
} from "@automerge/automerge-repo-keyhive";
import type { AutomergeUrl } from "@automerge/react/slim";
import { shortId, useDirectory } from "../directory/context";
import type { NameDirectory } from "../directory/types";
import type { KeyhiveRuntime } from "../runtime";
import { AccessBadge } from "./primitives/AccessBadge";
import { Avatar } from "./primitives/Avatar";

export interface PermissionsEditorProps {
  runtime: KeyhiveRuntime;
  hive: AutomergeRepoKeyhiveBase;
  docUrl: AutomergeUrl;
  /**
   * Counter that triggers a re-read of the member list. Pass the value from
   * `useKeyhiveUpdates`.
   */
  refreshToken?: number;
  /** Set false to stop loading, for example while a dialog is closed. */
  enabled?: boolean;
  /** Label for a member the directory does not know, such as a sync server. */
  labelForMember?: (member: DocMember) => string | undefined;
  showPublicAccess?: boolean;
  /** The level "Make Public" grants. Default `"edit"`. */
  publicAccessLevel?: "relay" | "read" | "edit" | "admin";
  fallbackAvatarSrc?: string;
  className?: string;
}

function memberLabel(
  member: DocMember,
  directory: NameDirectory,
  labelForMember?: (member: DocMember) => string | undefined
): string {
  if (member.isPublic) return "Public";
  return (
    directory.lookup(member.id)?.name ??
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
  runtime,
  hive,
  docUrl,
  refreshToken = 0,
  enabled = true,
  labelForMember,
  showPublicAccess = true,
  publicAccessLevel = "edit",
  fallbackAvatarSrc,
  className = "",
}: PermissionsEditorProps) {
  const directory = useDirectory();
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

  const adminAccess = useMemo(() => runtime.Access.admin(), [runtime]);
  const isAdmin = myAccess?.atLeast(adminAccess) ?? false;
  const canDelegate = myAccess?.isReader ?? false;

  // You can grant your own level or anything below it.
  const delegationOptions = useMemo(() => {
    if (!myAccess) return [];
    const { Access } = runtime;
    return [Access.relay(), Access.read(), Access.edit(), Access.admin()]
      .filter((level) => myAccess.atLeast(level))
      .map((level) => level.toString());
  }, [runtime, myAccess]);

  useEffect(() => {
    if (
      delegationOptions.length > 0 &&
      !delegationOptions.includes(selectedLevel)
    ) {
      setSelectedLevel(delegationOptions[delegationOptions.length - 1]);
    }
  }, [delegationOptions, selectedLevel]);

  const sortedMembers = useMemo(
    () =>
      [...members].sort((a, b) =>
        memberLabel(a, directory, labelForMember).localeCompare(
          memberLabel(b, directory, labelForMember)
        )
      ),
    [members, directory, labelForMember]
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
      setError(
        `Could not ${taskDescription}: ${err instanceof Error ? err.message : String(err)}`
      );
    } finally {
      setIsBusy(false);
    }
  };

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    const json = contactCardInput.trim();
    if (!json) return;

    void run("share document", async () => {
      const contactCard = runtime.ContactCard.fromJson(json);
      if (!contactCard) throw new Error("Not a valid contact card");
      // Throws on an unrecognized access level.
      const access = runtime.Access.fromString(selectedLevel);
      await hive.addMemberToDoc(docUrl, contactCard, access);
      setContactCardInput("");
    });
  };

  return (
    <div className={className}>
      {canDelegate && (
        <form onSubmit={handleAdd} className="kh-mb-6">
          <div className="kh-flex kh-gap-2">
            <input
              type="text"
              value={contactCardInput}
              onChange={(e) => setContactCardInput(e.target.value)}
              placeholder="Contact Card"
              aria-label="Contact card"
              className="kh-flex-1 kh-px-3 kh-py-2 kh-border kh-border-border kh-rounded-md kh-shadow-sm focus:kh-outline-none focus:kh-ring-2 focus:kh-ring-ring focus:kh-border-ring kh-text-sm kh-bg-background kh-text-foreground"
            />
            <select
              value={selectedLevel}
              onChange={(e) => setSelectedLevel(e.target.value)}
              aria-label="Access level"
              className="kh-px-3 kh-py-2 kh-border kh-border-border kh-rounded-md kh-shadow-sm focus:kh-outline-none focus:kh-ring-2 focus:kh-ring-ring focus:kh-border-ring kh-text-sm kh-bg-background kh-text-foreground"
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
              className="kh-px-4 kh-py-2 kh-bg-secondary kh-text-secondary-foreground kh-text-sm kh-font-medium kh-rounded-md hover:kh-bg-accent focus:kh-outline-none focus:kh-ring-2 focus:kh-ring-offset-2 focus:kh-ring-ring kh-transition-colors kh-border kh-border-border disabled:kh-opacity-50"
            >
              Add
            </button>
          </div>
        </form>
      )}

      {error && (
        <p role="alert" className="kh-mb-4 kh-text-sm kh-text-destructive">
          {error}
        </p>
      )}

      {showPublicAccess && (
        <div className="kh-mb-6 kh-flex kh-items-center kh-justify-between kh-gap-3">
          <p className="kh-text-sm kh-text-foreground">
            {currentPublicAccess ? (
              <>
                This document is <span className="kh-font-medium">public</span>{" "}
                ({currentPublicAccess.toUpperCase()})
              </>
            ) : (
              <>
                This document is <span className="kh-font-medium">private</span>
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
                className="kh-px-4 kh-py-2 kh-bg-secondary kh-text-secondary-foreground kh-text-sm kh-font-medium kh-rounded-md hover:kh-bg-accent focus:kh-outline-none focus:kh-ring-2 focus:kh-ring-offset-2 focus:kh-ring-ring kh-transition-colors kh-border kh-border-border disabled:kh-opacity-50"
              >
                Make Private
              </button>
            ) : (
              <button
                onClick={() =>
                  void run("make document public", () =>
                    hive.setPublicAccess(
                      docUrl,
                      runtime.Access.fromString(publicAccessLevel)
                    )
                  )
                }
                disabled={isBusy}
                className="kh-px-4 kh-py-2 kh-bg-secondary kh-text-secondary-foreground kh-text-sm kh-font-medium kh-rounded-md hover:kh-bg-accent focus:kh-outline-none focus:kh-ring-2 focus:kh-ring-offset-2 focus:kh-ring-ring kh-transition-colors kh-border kh-border-border disabled:kh-opacity-50"
              >
                Make Public
              </button>
            ))}
        </div>
      )}

      <hr className="kh-border-border kh-mb-6" />

      <div>
        <h3 className="kh-text-sm kh-font-medium kh-text-foreground kh-mb-4">
          Current Access
        </h3>
        <div className="kh-space-y-3">
          {isLoading ? (
            <p className="kh-text-sm kh-text-muted-foreground kh-italic">
              Loading...
            </p>
          ) : members.length === 0 ? (
            <p className="kh-text-sm kh-text-muted-foreground kh-italic">
              No users have access yet
            </p>
          ) : (
            sortedMembers.map((member) => {
              const label = memberLabel(member, directory, labelForMember);
              return (
                <div
                  key={member.id}
                  className="kh-flex kh-items-center kh-justify-between kh-gap-2 kh-py-2 kh-px-3 kh-bg-muted kh-rounded-md"
                >
                  <div className="kh-flex kh-items-center kh-space-x-3 kh-min-w-0">
                    <Avatar
                      avatar={directory.lookup(member.id)?.avatar}
                      name={label}
                      fallbackSrc={fallbackAvatarSrc}
                    />
                    <div className="kh-min-w-0">
                      <div className="kh-text-sm kh-font-medium kh-text-foreground kh-truncate">
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
                      className="kh-text-muted-foreground hover:kh-text-destructive kh-transition-colors kh-p-1 disabled:kh-opacity-50 kh-shrink-0"
                      aria-label={`Remove ${label}`}
                    >
                      <svg
                        className="kh-w-4 kh-h-4"
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

      {directory.notice && (
        <p className="kh-mt-4 kh-text-xs kh-text-muted-foreground">
          {directory.notice}
        </p>
      )}
    </div>
  );
}
