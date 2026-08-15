import { AutomergeUrl } from "@automerge/react/slim";
import { AutomergeRepoKeyhive } from "@automerge/automerge-repo-keyhive";
import { Modal, PermissionsEditor } from "keyhive-react";
import blankAvatarImg from "../assets/blankavatar.jpeg";
import { Phonebook } from "../phonebook";
import * as syncServer from "../syncServer";

interface ShareModalProps {
  isOpen: boolean;
  docUrl: AutomergeUrl;
  phonebook: Phonebook | undefined;
  hive: AutomergeRepoKeyhive;
  keyhiveVersion: number;
  onClose: () => void;
}

export function ShareModal({
  isOpen,
  docUrl,
  phonebook,
  hive,
  keyhiveVersion,
  onClose,
}: ShareModalProps) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Share this list">
      <PermissionsEditor
        hive={hive}
        docUrl={docUrl}
        contacts={phonebook}
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
