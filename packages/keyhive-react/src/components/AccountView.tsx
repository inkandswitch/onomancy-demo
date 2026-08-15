import { useEffect, useId, useRef, useState } from "react";
import type { Contact, ContactMap } from "../contacts";
import { useSelfIdentity, type KeyhiveHive } from "../hooks/useSelfIdentity";
import { Avatar } from "./primitives/Avatar";
import { CopyableField } from "./primitives/CopyableField";

export interface AccountViewProps {
  hive: KeyhiveHive;
  /** Known display information, used to populate the form. */
  contacts: ContactMap | undefined;
  /** Persist the local identity's own entry. Omit to make the view read-only. */
  onSave?: (id: string, contact: Contact) => void | Promise<void>;
  onSaved?: () => void;
  /** Renders a Cancel button when supplied. */
  onCancel?: () => void;
  showIdentifiers?: boolean;
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
  contacts,
  onSave,
  onSaved,
  onCancel,
  showIdentifiers = true,
  fallbackAvatarSrc,
  className = "",
}: AccountViewProps) {
  const self = useSelfIdentity(hive);
  const entry = contacts?.[self.id];
  const fieldId = useId();

  const [name, setName] = useState(entry?.name ?? "");
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const nameEdited = useRef(false);
  useEffect(() => {
    if (!nameEdited.current && entry?.name) setName(entry.name);
  }, [entry?.name]);

  useEffect(() => {
    if (!avatarFile) {
      setFilePreview(null);
      return;
    }
    const url = URL.createObjectURL(avatarFile);
    setFilePreview(url);
    return () => URL.revokeObjectURL(url);
  }, [avatarFile]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!onSave) return;

    setError(null);
    setIsSaving(true);
    try {
      const avatar = avatarFile
        ? new Uint8Array(await avatarFile.arrayBuffer())
        : (entry?.avatar ?? null);
      await onSave(self.id, { peerId: self.peerId, name, avatar });
      setAvatarFile(null);
      onSaved?.();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not save profile."
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <form
      onSubmit={(e) => void handleSubmit(e)}
      className={`space-y-6 ${className}`}
    >
      <div className="flex flex-col items-center space-y-4">
        {filePreview ? (
          <img
            src={filePreview}
            alt="Avatar preview"
            className="w-20 h-20 rounded-full object-cover border-4 border-border"
          />
        ) : (
          <Avatar
            avatar={entry?.avatar}
            name={name}
            sizeClassName="w-20 h-20"
            fallbackSrc={fallbackAvatarSrc}
            className="border-4 border-border"
          />
        )}

        <div>
          <label
            htmlFor={`${fieldId}-avatar`}
            className="cursor-pointer inline-flex items-center px-4 py-2 border border-border rounded-md shadow-sm text-sm font-medium text-secondary-foreground bg-secondary hover:bg-accent focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-ring"
          >
            <svg
              className="w-4 h-4 mr-2"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
              />
            </svg>
            Upload Avatar
          </label>
          <input
            id={`${fieldId}-avatar`}
            type="file"
            accept="image/*"
            onChange={(e) => setAvatarFile(e.target.files?.[0] ?? null)}
            className="hidden"
          />
        </div>
      </div>

      <div>
        <label
          htmlFor={`${fieldId}-name`}
          className="block text-sm font-medium text-foreground mb-2"
        >
          Name
        </label>
        <input
          type="text"
          id={`${fieldId}-name`}
          value={name}
          onChange={(e) => {
            nameEdited.current = true;
            setName(e.target.value);
          }}
          className="w-full px-3 py-2 border border-border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-ring focus:border-ring bg-background text-foreground"
          placeholder="Enter your name"
        />
      </div>

      <CopyableField
        label="Contact Card"
        value={self.contactCardJson}
        help="Share this so other users can grant your account access to a document or group."
      />

      {showIdentifiers && (
        <dl className="text-xs text-muted-foreground space-y-1">
          <div className="flex gap-2">
            <dt className="font-medium">Keyhive id</dt>
            <dd className="font-mono break-all">{self.id}</dd>
          </div>
          <div className="flex gap-2">
            <dt className="font-medium">Peer id</dt>
            <dd className="font-mono break-all">{self.peerId}</dd>
          </div>
        </dl>
      )}

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}

      <div className="flex justify-end space-x-3 pt-4">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 text-sm font-medium text-secondary-foreground bg-secondary border border-border rounded-md hover:bg-accent focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-ring"
          >
            Cancel
          </button>
        )}
        <button
          type="submit"
          disabled={!onSave || isSaving}
          className="px-4 py-2 text-sm font-medium text-primary-foreground bg-primary border border-transparent rounded-md hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-ring disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSaving ? "Saving..." : "Save"}
        </button>
      </div>
    </form>
  );
}
