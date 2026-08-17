export { createKeyhiveRuntime } from "./runtime";
export type { KeyhiveModule, KeyhiveRuntime } from "./runtime";
export { bytesToHex, hexToBytes, peerIdWithoutSuffix } from "./bytes";

export type {
  DirectoryEntry,
  DirectoryEntryKind,
  DirectoryTrust,
  NameDirectory,
} from "./directory/types";
export { emptyDirectory } from "./directory/types";
export {
  shortId,
  useDirectory,
  useDirectoryEntries,
  useDirectoryEntry,
  useDisplayName,
} from "./directory/context";
export type { DirectoryContextValue } from "./directory/context";
export { createAutomergeDocDirectory } from "./directory/automerge-directory";
export type {
  AutomergeDocDirectoryOptions,
  DirectoryDoc,
  DirectoryDocChange,
} from "./directory/automerge-directory";
export { useAutomergeDocDirectory } from "./directory/useAutomergeDocDirectory";

export {
  agentKindOf,
  createDocumentTarget,
  createGroupTarget,
  grantableLevels,
  publicIdHex,
} from "./permissions/targets";
export type {
  AgentKind,
  GroupTargetOptions,
  PermissionTarget,
  TargetMember,
} from "./permissions/targets";
export { useTargetMembers } from "./permissions/useTargetMembers";
export type { TargetMembersState } from "./permissions/useTargetMembers";

export { useAvatarUrl } from "./hooks/useAvatarUrl";
export { useKeyhiveUpdates } from "./hooks/useKeyhiveUpdates";
export { useReRenderOnDocProgress } from "./hooks/useDocProgress";
export { useSelfIdentity } from "./hooks/useSelfIdentity";
export type { KeyhiveHive, SelfIdentity } from "./hooks/useSelfIdentity";

export { AccountView } from "./components/AccountView";
export { ContactBook } from "./components/ContactBook";
export { ProfileEditor } from "./components/ProfileEditor";
export type { AccountViewProps } from "./components/AccountView";
export type { ContactBookProps } from "./components/ContactBook";
export type { ProfileEditorProps } from "./components/ProfileEditor";
export { DirectoryProvider } from "./components/DirectoryProvider";
export type { DirectoryProviderProps } from "./components/DirectoryProvider";
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
