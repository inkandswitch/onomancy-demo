import { useEffect, useMemo, useState } from "react";
import { AutomergeUrl } from "@automerge/react/slim";
import {
  Access,
  AutomergeRepoKeyhive,
} from "@automerge/automerge-repo-keyhive";
import {
  createDocumentTarget,
  Modal,
  AccessEditor,
} from "@automerge/keyhive-react";
import { keyhiveRuntime } from "../keyhiveRuntime";
import blankAvatarImg from "../assets/blankavatar.jpeg";
import * as syncServer from "../syncServer";
import { createInviteLink } from "../invite";
import { copyToClipboard } from "../clipboard";
import { errorMessage, log } from "../log";

interface ShareModalProps {
  isOpen: boolean;
  docUrl: AutomergeUrl;
  hive: AutomergeRepoKeyhive;
  keyhiveVersion: number;
  onClose: () => void;
}

export function ShareModal({
  isOpen,
  docUrl,
  hive,
  keyhiveVersion,
  onClose,
}: ShareModalProps) {
  const target = useMemo(
    () => createDocumentTarget(keyhiveRuntime, hive, docUrl),
    [hive, docUrl]
  );

  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [isCreatingInvite, setIsCreatingInvite] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);

  // A link belongs to the document it was made for, so drop it when the modal
  // is reopened or pointed at a different list.
  useEffect(() => {
    setInviteLink(null);
    setInviteError(null);
  }, [docUrl, isOpen]);

  // Create a throwaway identity, give it the selected access level, and return
  // a link that lets anyone act as it. The identity shows up in the member list
  // below like any other member, which is also how the link gets turned off.
  const handleCreateInviteLink = async (level: string) => {
    if (isCreatingInvite) return;
    setInviteError(null);
    setIsCreatingInvite(true);
    try {
      const link = await createInviteLink(
        hive,
        docUrl,
        Access.fromString(level)
      );
      setInviteLink(link);
      await copyToClipboard(link);
    } catch (err) {
      log.error("Error creating invite link:", err);
      setInviteError(`Could not create an invite link: ${errorMessage(err)}`);
    } finally {
      setIsCreatingInvite(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Share this list">
      <AccessEditor
        target={target}
        refreshToken={keyhiveVersion}
        enabled={isOpen}
        labelForMember={(member) =>
          member.isSyncServer ? syncServer.DISPLAY_NAME : undefined
        }
        fallbackAvatarSrc={blankAvatarImg}
        renderAfterAdd={({ selectedLevel }) => (
          <>
            <div className="flex items-center justify-between">
              <p className="text-sm text-foreground">
                Invite link ({selectedLevel.toUpperCase()})
              </p>
              <button
                onClick={() => void handleCreateInviteLink(selectedLevel)}
                disabled={isCreatingInvite}
                className="px-4 py-2 bg-secondary text-secondary-foreground text-sm font-medium rounded-md hover:bg-accent focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-ring transition-colors border border-border disabled:opacity-50"
              >
                {isCreatingInvite ? "Creating..." : "Create invite link"}
              </button>
            </div>
            {inviteError && (
              <p role="alert" className="mt-2 text-sm text-destructive">
                {inviteError}
              </p>
            )}
            {inviteLink && (
              <div className="mt-3">
                <div className="flex gap-2">
                  <input
                    type="text"
                    readOnly
                    value={inviteLink}
                    onFocus={(e) => e.target.select()}
                    aria-label="Invite link"
                    className="flex-1 px-3 py-2 border border-border rounded-md shadow-sm text-sm bg-muted text-foreground"
                  />
                  <button
                    onClick={() => void copyToClipboard(inviteLink)}
                    className="px-4 py-2 bg-secondary text-secondary-foreground text-sm font-medium rounded-md hover:bg-accent focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-ring transition-colors border border-border"
                  >
                    Copy
                  </button>
                </div>
                <p className="mt-2 text-sm text-muted-foreground">
                  Copied. Anyone with this link can join, as many times as you
                  like. To turn it off, remove the new member below.
                </p>
              </div>
            )}
          </>
        )}
      />
    </Modal>
  );
}
