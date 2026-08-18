import type { DirectoryEntry } from "../directory/types";
import { useSelfIdentity, type KeyhiveHive } from "../hooks/useSelfIdentity";
import { CopyableField } from "./primitives/CopyableField";
import { ProfileEditor } from "./ProfileEditor";

export interface AccountViewProps {
  hive: KeyhiveHive;
  /** Called after the profile has been written to the directory. */
  onSaved?: (entry: DirectoryEntry) => void;
  /** Renders a Cancel button when supplied. */
  onCancel?: () => void;
  showIdentifiers?: boolean;
  /**
   * Publish the contact card into the directory so someone who finds this
   * account by name can share with it without needing a new contact card.
   */
  publishContactCard?: boolean;
  fallbackAvatarSrc?: string;
  className?: string;
}

/**
 * Manage the local account's display name, avatar, and the contact card other
 * peers need in order to share with this identity.
 *
 * A keyhive identity is a key pair, constructed on first run and held in the
 * hive's storage.
 */
export function AccountView({
  hive,
  onSaved,
  onCancel,
  showIdentifiers = true,
  publishContactCard = false,
  fallbackAvatarSrc,
  className = "",
}: AccountViewProps) {
  const self = useSelfIdentity(hive);

  return (
    <ProfileEditor
      id={self.id}
      kind="individual"
      peerId={self.peerId}
      contactCardJson={publishContactCard ? self.contactCardJson : undefined}
      namePlaceholder="Enter your name"
      onSaved={onSaved}
      onCancel={onCancel}
      fallbackAvatarSrc={fallbackAvatarSrc}
      className={className}
    >
      <CopyableField
        label="Contact Card"
        value={self.contactCardJson}
        help="Share this so other users can grant your account access to a document or group."
      />

      {showIdentifiers && (
        <dl className="kh-text-xs kh-text-muted-foreground kh-space-y-1">
          <div className="kh-flex kh-gap-2">
            <dt className="kh-font-medium">Keyhive id</dt>
            <dd className="kh-font-mono kh-break-all">{self.id}</dd>
          </div>
          <div className="kh-flex kh-gap-2">
            <dt className="kh-font-medium">Peer id</dt>
            <dd className="kh-font-mono kh-break-all">{self.peerId}</dd>
          </div>
        </dl>
      )}
    </ProfileEditor>
  );
}
