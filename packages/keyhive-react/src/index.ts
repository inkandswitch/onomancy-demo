export { shortId } from "./contacts";
export type { Contact, ContactMap } from "./contacts";

export { useAvatarUrl } from "./hooks/useAvatarUrl";
export {
  useKeyhiveUpdates,
  useReRenderOnDocProgress,
} from "./hooks/useKeyhiveUpdates";
export { useSelfIdentity } from "./hooks/useSelfIdentity";
export type { KeyhiveHive, SelfIdentity } from "./hooks/useSelfIdentity";

export { AccountView } from "./components/AccountView";
export type { AccountViewProps } from "./components/AccountView";
export { PermissionsEditor } from "./components/PermissionsEditor";
export type { PermissionsEditorProps } from "./components/PermissionsEditor";

export { AccessBadge } from "./components/primitives/AccessBadge";
export type { AccessBadgeProps } from "./components/primitives/AccessBadge";
export { Avatar } from "./components/primitives/Avatar";
export type { AvatarProps } from "./components/primitives/Avatar";
export { CopyableField } from "./components/primitives/CopyableField";
export type { CopyableFieldProps } from "./components/primitives/CopyableField";
export { Modal } from "./components/primitives/Modal";
export type { ModalProps } from "./components/primitives/Modal";
