import { useEffect, useId, useRef, useState } from "react";
import { useDirectory, useDirectoryEntry } from "../directory/context";
import type { DirectoryEntry } from "../directory/types";
import { useSelfIdentity, type KeyhiveHive } from "../hooks/useSelfIdentity";
import { Avatar } from "./primitives/Avatar";
import { CopyableField } from "./primitives/CopyableField";

export interface AccountViewProps {
  hive: KeyhiveHive;
  /** Called after the profile has been written to the directory. */
  onSaved?: (entry: DirectoryEntry) => void;
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
  onSaved,
  onCancel,
  showIdentifiers = true,
  fallbackAvatarSrc,
  className = "",
}: AccountViewProps) {
  const directory = useDirectory();
  const self = useSelfIdentity(hive);
  const entry = useDirectoryEntry(self.id);
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
    if (!directory.publish) return;

    setError(null);
    setIsSaving(true);
    try {
      const avatar = avatarFile
        ? new Uint8Array(await avatarFile.arrayBuffer())
        : (entry?.avatar ?? null);
      const updated: DirectoryEntry = {
        id: self.id,
        peerId: self.peerId,
        name,
        avatar,
      };
      await directory.publish(updated);
      setAvatarFile(null);
      onSaved?.(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save profile.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <form
      onSubmit={(e) => void handleSubmit(e)}
      className={`kh-space-y-6 ${className}`}
    >
      <div className="kh-flex kh-flex-col kh-items-center kh-space-y-4">
        {filePreview ? (
          <img
            src={filePreview}
            alt="Avatar preview"
            className="kh-w-20 kh-h-20 kh-rounded-full kh-object-cover kh-border-4 kh-border-border"
          />
        ) : (
          <Avatar
            avatar={entry?.avatar}
            name={name}
            sizeClassName="kh-w-20 kh-h-20"
            fallbackSrc={fallbackAvatarSrc}
            className="kh-border-4 kh-border-border"
          />
        )}

        <div>
          <label
            htmlFor={`${fieldId}-avatar`}
            className="kh-cursor-pointer kh-inline-flex kh-items-center kh-px-4 kh-py-2 kh-border kh-border-border kh-rounded-md kh-shadow-sm kh-text-sm kh-font-medium kh-text-secondary-foreground kh-bg-secondary hover:kh-bg-accent focus:kh-outline-none focus:kh-ring-2 focus:kh-ring-offset-2 focus:kh-ring-ring"
          >
            <svg
              className="kh-w-4 kh-h-4 kh-mr-2"
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
            className="kh-hidden"
          />
        </div>
      </div>

      <div>
        <label
          htmlFor={`${fieldId}-name`}
          className="kh-block kh-text-sm kh-font-medium kh-text-foreground kh-mb-2"
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
          className="kh-w-full kh-px-3 kh-py-2 kh-border kh-border-border kh-rounded-md kh-shadow-sm focus:kh-outline-none focus:kh-ring-2 focus:kh-ring-ring focus:kh-border-ring kh-bg-background kh-text-foreground"
          placeholder="Enter your name"
        />
      </div>

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

      {!directory.writable && (
        <p className="kh-text-sm kh-text-muted-foreground">
          The name directory is read-only, so your name and avatar cannot be
          changed here.
        </p>
      )}

      {directory.notice && (
        <p className="kh-text-xs kh-text-muted-foreground">
          {directory.notice}
        </p>
      )}

      {error && (
        <p role="alert" className="kh-text-sm kh-text-destructive">
          {error}
        </p>
      )}

      <div className="kh-flex kh-justify-end kh-space-x-3 kh-pt-4">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="kh-px-4 kh-py-2 kh-text-sm kh-font-medium kh-text-secondary-foreground kh-bg-secondary kh-border kh-border-border kh-rounded-md hover:kh-bg-accent focus:kh-outline-none focus:kh-ring-2 focus:kh-ring-offset-2 focus:kh-ring-ring"
          >
            Cancel
          </button>
        )}
        <button
          type="submit"
          disabled={!directory.writable || isSaving}
          className="kh-px-4 kh-py-2 kh-text-sm kh-font-medium kh-text-primary-foreground kh-bg-primary kh-border kh-border-transparent kh-rounded-md hover:kh-bg-primary/90 focus:kh-outline-none focus:kh-ring-2 focus:kh-ring-offset-2 focus:kh-ring-ring disabled:kh-opacity-50 disabled:kh-cursor-not-allowed"
        >
          {isSaving ? "Saving..." : "Save"}
        </button>
      </div>
    </form>
  );
}
