import {
  AutomergeUrl,
  useDocument,
  updateText,
  useRepo,
} from "@automerge/react/slim";
import { ShareModal } from "./ShareModal";
import { useState, useEffect, useMemo } from "react";
import {
  Access,
  AutomergeRepoKeyhive,
  isUnprotectedDoc,
} from "@automerge/automerge-repo-keyhive";
import { useReRenderOnDocProgress } from "@automerge/keyhive-react";
import { TaskList as TaskListDoc } from "../taskListDoc";
import { copyToClipboard } from "../clipboard";
import { log } from "../log";

function sameAccess(a: Access | undefined, b: Access | undefined): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  return a.equals(b);
}

interface TaskListProps {
  docUrl: AutomergeUrl;
  hive: AutomergeRepoKeyhive;
  keyhiveVersion: number;
}

export const TaskList = ({ docUrl, hive, keyhiveVersion }: TaskListProps) => {
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [access, setAccess] = useState<Access | undefined>(undefined);
  const [accessChecked, setAccessChecked] = useState(false);

  // Re-render when the document becomes available so a newly-granted doc
  // renders without a page reload (see useReRenderOnDocProgress).
  useReRenderOnDocProgress(useRepo(), docUrl);
  const [doc, changeDoc] = useDocument<TaskListDoc>(docUrl);

  const isUnprotected = useMemo(() => {
    try {
      return isUnprotectedDoc(docUrl);
    } catch {
      return false;
    }
  }, [docUrl]);

  // Check access to this document. Recalculated when keyhive state changes.
  useEffect(() => {
    let cancelled = false;

    if (isUnprotected) {
      setAccess(undefined);
      setAccessChecked(true);
      return;
    }

    async function fetchAccess() {
      try {
        // The better of this identity's own membership and any public access,
        // so a publicly-shared document is readable by a peer with no
        // membership of its own.
        const best = await hive.bestAccessForDoc(
          hive.active.individual.id,
          docUrl
        );
        // Store a new Access only when it actually differs. Every call returns
        // a fresh object, so setting it unconditionally would re-render on
        // every check, re-run this effect, and never settle.
        if (!cancelled)
          setAccess((prev) => (sameAccess(prev, best) ? prev : best));
      } catch (error) {
        if (!cancelled) {
          log.error("Error checking access level:", error);
          setAccess(undefined);
        }
      } finally {
        if (!cancelled) setAccessChecked(true);
      }
    }

    void fetchAccess();

    return () => {
      cancelled = true;
    };
  }, [keyhiveVersion, docUrl, hive, isUnprotected]);

  const canRead = isUnprotected || (access?.isReader ?? false);
  const canEdit = isUnprotected || (access?.isEditor ?? false);
  // Relay access doesn't allow you to delegate or revoke, so read access
  // is required to share a doc.
  const canShare = !isUnprotected && canRead;
  const docId = docUrl.replace("automerge:", "");

  // Wait for the first access check, and for an accessible document to finish
  // syncing, before deciding what to show.
  if (!accessChecked || (canRead && !doc)) {
    return (
      <div className="h-full flex items-center justify-center bg-muted text-muted-foreground">
        Loading...
      </div>
    );
  }

  if (!canRead || !doc) {
    return (
      <div className="h-full flex flex-col bg-muted">
        <div className="flex-1 overflow-y-auto flex justify-center items-start py-8">
          <div className="w-full max-w-2xl px-6">
            <div className="bg-background rounded-lg p-6 shadow-sm">
              <div className="pb-6 mb-6">
                <div className="flex items-center gap-2">
                  <h2 className="text-sm text-muted-foreground">
                    Doc ID: {docId}
                  </h2>
                  <button
                    type="button"
                    onClick={() => {
                      void copyToClipboard(docId);
                    }}
                    className="px-2 py-1 text-xs font-medium text-secondary-foreground bg-secondary border border-border rounded hover:bg-accent"
                  >
                    Copy
                  </button>
                </div>
              </div>
              <div className="text-center py-8">
                <p className="text-muted-foreground">
                  You do not have access to this document
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-muted">
      <div className="flex-1 overflow-y-auto flex justify-center items-start py-8">
        <div className="w-full max-w-2xl px-6">
          <div className="bg-background rounded-lg p-6 shadow-sm">
            {isUnprotected && (
              <div className="mb-6 rounded-md border border-border bg-muted px-4 py-3 text-sm text-muted-foreground">
                This document is{" "}
                <span className="font-medium">unprotected</span>.
              </div>
            )}
            <div className="pb-6 mb-6">
              <div className="flex items-center gap-3 mb-6">
                {canEdit ? (
                  <input
                    type="text"
                    value={doc.title}
                    onChange={(e) =>
                      changeDoc((d) => {
                        updateText(d, ["title"], e.target.value);
                      })
                    }
                    className="flex-1 px-3 py-2 border border-border rounded-md text-lg font-medium bg-background text-foreground"
                  />
                ) : (
                  <h1 className="flex-1 text-lg font-medium text-foreground">
                    {doc.title}
                  </h1>
                )}
                <button
                  type="button"
                  onClick={
                    canShare ? () => setIsShareModalOpen(true) : undefined
                  }
                  disabled={!canShare}
                  className={`px-4 py-2 border rounded-md text-sm font-medium transition-colors ${
                    canShare
                      ? "bg-secondary text-secondary-foreground border-border cursor-pointer hover:bg-accent hover:border-ring"
                      : "bg-muted text-muted-foreground border-muted cursor-not-allowed opacity-50"
                  }`}
                >
                  Share
                </button>
              </div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm text-muted-foreground">
                  Doc ID: {docId}
                </h2>
                <button
                  type="button"
                  onClick={() => {
                    void copyToClipboard(docId);
                  }}
                  className="px-2 py-1 text-xs font-medium text-secondary-foreground bg-secondary border border-border rounded hover:bg-accent"
                >
                  Copy
                </button>
              </div>
            </div>

            {canEdit && (
              <div className="flex justify-start items-center mb-2">
                <button
                  type="button"
                  onClick={() => {
                    changeDoc((d) =>
                      d.tasks.unshift({
                        title: "",
                        done: false,
                      })
                    );
                  }}
                  className="px-4 py-2 bg-secondary text-secondary-foreground border border-border rounded-md text-sm font-medium cursor-pointer hover:bg-accent hover:border-ring transition-colors"
                >
                  + New task
                </button>
              </div>
            )}

            <div className="flex flex-col gap-3">
              {doc &&
                doc.tasks?.map(({ title, done }, index) => (
                  <div className="flex items-center gap-3" key={index}>
                    <input
                      type="checkbox"
                      checked={done}
                      onChange={
                        canEdit
                          ? () =>
                              changeDoc((d) => {
                                d.tasks[index].done = !d.tasks[index].done;
                              })
                          : undefined
                      }
                      disabled={!canEdit}
                      className={`w-4 h-4 accent-primary ${!canEdit ? "cursor-not-allowed opacity-50" : ""}`}
                    />

                    {canEdit ? (
                      <input
                        type="text"
                        placeholder="What needs doing?"
                        value={title || ""}
                        onChange={(e) =>
                          changeDoc((d) => {
                            updateText(
                              d,
                              ["tasks", index, "title"],
                              e.target.value
                            );
                          })
                        }
                        className={`flex-1 px-3 py-2 border border-border rounded-md text-sm bg-background ${
                          done
                            ? "line-through text-muted-foreground"
                            : "text-foreground"
                        }`}
                      />
                    ) : (
                      <div
                        className={`flex-1 px-3 py-2 text-sm ${
                          done
                            ? "line-through text-muted-foreground"
                            : "text-foreground"
                        }`}
                      >
                        {title || ""}
                      </div>
                    )}
                  </div>
                ))}
            </div>
          </div>
        </div>
      </div>
      <ShareModal
        isOpen={isShareModalOpen}
        docUrl={docUrl}
        hive={hive}
        keyhiveVersion={keyhiveVersion}
        onClose={() => setIsShareModalOpen(false)}
      />
    </div>
  );
};
