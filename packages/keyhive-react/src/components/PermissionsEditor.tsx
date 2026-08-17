import { useEffect, useMemo, useState } from "react";
import { shortId, useDirectory } from "../directory/context";
import type { NameDirectory } from "../directory/types";
import {
  grantableLevels,
  type PermissionTarget,
  type TargetMember,
} from "../permissions/targets";
import { useTargetMembers } from "../permissions/useTargetMembers";
import { AccessBadge } from "./primitives/AccessBadge";
import { Avatar } from "./primitives/Avatar";

export interface PermissionsEditorProps {
  /** The document or group whose membership is being edited. */
  target: PermissionTarget;
  /**
   * Counter that triggers a re-read of the member list. Pass the value from
   * `useKeyhiveUpdates`.
   */
  refreshToken?: number;
  /** Set false to stop loading, for example while a dialog is closed. */
  enabled?: boolean;
  /** Label for a member the directory does not know, such as a sync server. */
  labelForMember?: (member: TargetMember) => string | undefined;
  showPublicAccess?: boolean;
  /** Renders a per-member button that calls this. */
  onInspectMember?: (memberId: string) => void;
  /** The level "Make Public" grants. Default `"edit"`. */
  publicAccessLevel?: "relay" | "read" | "edit" | "admin";
  fallbackAvatarSrc?: string;
  className?: string;
}

function memberLabel(
  member: TargetMember,
  directory: NameDirectory,
  labelForMember?: (member: TargetMember) => string | undefined
): string {
  if (member.isPublic) return "Public";
  return (
    directory.lookup(member.id)?.name ??
    labelForMember?.(member) ??
    shortId(member.id)
  );
}

/**
 * Add and remove members on a keyhive document or group at a chosen access
 * level.
 *
 * You can only delegate at levels at or below your own access levels. And only
 * an admin can revoke members, and only where a revocation here takes effect.
 */
export function PermissionsEditor({
  target,
  refreshToken = 0,
  enabled = true,
  labelForMember,
  showPublicAccess = true,
  onInspectMember,
  publicAccessLevel = "edit",
  fallbackAvatarSrc,
  className = "",
}: PermissionsEditorProps) {
  const directory = useDirectory();
  const runtime = target.runtime;
  const {
    members,
    isLoading,
    error: loadError,
    refresh,
  } = useTargetMembers(target, refreshToken, enabled);

  const [contactCardInput, setContactCardInput] = useState("");
  const [selectedLevel, setSelectedLevel] = useState("Edit");
  const [error, setError] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);

  const myAccess = members.find((m) => m.isSelf)?.access;
  const publicMember = members.find((m) => m.isPublic);
  const currentPublicAccess = publicMember?.access.toString();

  const adminAccess = useMemo(() => runtime.Access.admin(), [runtime]);
  const isAdmin = myAccess?.atLeast(adminAccess) ?? false;
  const canDelegate = myAccess?.isReader ?? false;

  // You can grant your own level or anything below it.
  const delegationOptions = useMemo(
    () => grantableLevels(runtime, myAccess).map((level) => level.toString()),
    [runtime, myAccess]
  );

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
      refresh();
    } catch (err) {
      setError(
        `Could not ${taskDescription}: ${err instanceof Error ? err.message : String(err)}`
      );
    } finally {
      setIsBusy(false);
    }
  };

  const noun = target.kind === "group" ? "group" : "document";

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    const json = contactCardInput.trim();
    if (!json) return;

    void run(`share ${noun}`, async () => {
      const contactCard = runtime.ContactCard.fromJson(json);
      if (!contactCard) throw new Error("Not a valid contact card");
      // Throws on an unrecognized access level.
      const access = runtime.Access.fromString(selectedLevel);
      await target.addMember(contactCard, access);
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

      {(error || loadError) && (
        <p role="alert" className="kh-mb-4 kh-text-sm kh-text-destructive">
          {error ?? loadError}
        </p>
      )}

      {showPublicAccess && target.supportsPublicAccess && (
        <div className="kh-mb-6 kh-flex kh-items-center kh-justify-between kh-gap-3">
          <p className="kh-text-sm kh-text-foreground">
            {currentPublicAccess ? (
              <>
                This {noun} is <span className="kh-font-medium">public</span> (
                {currentPublicAccess.toUpperCase()})
              </>
            ) : (
              <>
                This {noun} is <span className="kh-font-medium">private</span>
              </>
            )}
          </p>
          {isAdmin &&
            (currentPublicAccess ? (
              <button
                onClick={() =>
                  // Making a document private revokes the public member.
                  void run(`make ${noun} private`, async () => {
                    if (publicMember)
                      await target.removeMember(publicMember.id);
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
                  void run(`make ${noun} public`, () =>
                    target.setPublicAccess(
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
                        {member.kind === "group" && (
                          <span className="kh-ml-2 kh-text-xs kh-text-muted-foreground">
                            (group)
                          </span>
                        )}
                      </div>
                      <div className="kh-flex kh-items-center kh-gap-2">
                        <AccessBadge access={member.access.toString()} />
                        {!member.isDirect && (
                          <span className="kh-text-xs kh-text-muted-foreground">
                            through a group
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="kh-flex kh-items-center kh-gap-1 kh-shrink-0">
                    {onInspectMember && (
                      <button
                        type="button"
                        onClick={() => onInspectMember(member.id)}
                        className="kh-text-xs kh-text-muted-foreground hover:kh-text-foreground kh-transition-colors kh-px-2 kh-py-1"
                      >
                        Why?
                      </button>
                    )}
                    {isAdmin &&
                      !member.isSelf &&
                      !member.isSyncServer &&
                      member.isDirect && (
                        <button
                          type="button"
                          onClick={() =>
                            void run("remove member", () =>
                              target.removeMember(member.id)
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
