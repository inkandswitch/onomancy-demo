import { AutomergeUrl } from "@automerge/react/slim";
import { AutomergeRepoKeyhive } from "@automerge/automerge-repo-keyhive";
import { Modal, PermissionsEditor } from "keyhive-react";
import { keyhiveRuntime } from "../keyhiveRuntime";
import blankAvatarImg from "../assets/blankavatar.jpeg";
import * as syncServer from "../syncServer";

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
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Share this list">
      <PermissionsEditor
        runtime={keyhiveRuntime}
        hive={hive}
        docUrl={docUrl}
        refreshToken={keyhiveVersion}
        enabled={isOpen}
        labelForMember={(member) =>
          member.isSyncServer ? syncServer.DISPLAY_NAME : undefined
        }
        fallbackAvatarSrc={blankAvatarImg}
      />
    </Modal>
  );
}
