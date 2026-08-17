import type {
  Access,
  ContactCard,
  DocumentId,
  Identifier,
} from "@automerge/automerge-repo-keyhive";
import type { AutomergeUrl } from "@automerge/react/slim";

/**
 * The keyhive constructors this package needs supplied by the application so
 * that there is only ever one instance of the WASM-backed packages.
 */
export interface KeyhiveRuntime {
  readonly Access: {
    relay(): Access;
    read(): Access;
    edit(): Access;
    admin(): Access;
    /** Case-insensitive. Throws on an unrecognized level. */
    fromString(level: string): Access;
  };
  readonly ContactCard: {
    fromJson(json: string): ContactCard | undefined;
  };
  readonly Identifier: {
    new (bytes: Uint8Array): Identifier;
    publicId(): Identifier;
  };
  docIdFromAutomergeUrl(url: AutomergeUrl): DocumentId;
  isUnprotectedDoc(url: AutomergeUrl): boolean;
}

/** The subset of ARK's exports the runtime reads. */
export type KeyhiveModule = KeyhiveRuntime;

/** Build a runtime from the application's own ARK import. */
export function createKeyhiveRuntime(ark: KeyhiveModule): KeyhiveRuntime {
  return {
    Access: ark.Access,
    ContactCard: ark.ContactCard,
    Identifier: ark.Identifier,
    docIdFromAutomergeUrl: (url) => ark.docIdFromAutomergeUrl(url),
    isUnprotectedDoc: (url) => ark.isUnprotectedDoc(url),
  };
}
