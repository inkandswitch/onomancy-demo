import { useMemo } from "react";
import { AutomergeUrl } from "@automerge/react/slim";
import { AutomergeRepoKeyhive } from "@automerge/automerge-repo-keyhive";
import {
  createDocumentTarget,
  Modal,
  AccessEditor,
} from "@automerge/keyhive-react";
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
  const target = useMemo(
    () => createDocumentTarget(keyhiveRuntime, hive, docUrl),
    [hive, docUrl]
  );

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
      />
    </Modal>
  );
}
