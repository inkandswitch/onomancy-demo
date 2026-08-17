import type {
  Access,
  Agent,
  AutomergeRepoKeyhiveBase,
  Capability,
  ContactCard,
  Group,
} from "@automerge/automerge-repo-keyhive";
import type { AutomergeUrl } from "@automerge/react/slim";
import { bytesToHex, hexToBytes } from "../bytes";
import type { KeyhiveRuntime } from "../runtime";

export type AgentKind = "individual" | "group" | "document" | "unknown";

export interface TargetMember {
  /** Hex-encoded keyhive identifier accepted by `removeMember`. */
  id: string;
  access: Access;
  isSelf: boolean;
  isPublic: boolean;
  isSyncServer: boolean;
  /** False when the member holds access through a group, where revoking here
   * would not take it away. */
  isDirect: boolean;
  kind: AgentKind;
}

/**
 * A keyhive document or group. ARK manages documents by `AutomergeUrl` but
 * does not currently manage groups, which go through `hive.keyhive` here.
 */
export interface PermissionTarget {
  kind: "document" | "group";
  /** Stable string identifying the target for use as an effect dependency. */
  key: string;
  hive: AutomergeRepoKeyhiveBase;
  runtime: KeyhiveRuntime;
  supportsPublicAccess: boolean;
  listMembers(): Promise<TargetMember[]>;
  /**
   * Grant access to an individual. A contact card carries the prekeys needed
   * to encrypt to someone the local keyhive has not met.
   */
  addMember(contactCard: ContactCard, access: Access): Promise<void>;
  /**
   * Grant access to an agent the local keyhive already holds, which is how a
   * group is added. Groups have no contact card and their members' prekeys
   * are already known.
   */
  addAgent(agent: Agent, access: Access): Promise<void>;
  removeMember(memberId: string): Promise<void>;
  setPublicAccess(access: Access): Promise<void>;
  /** The direct delegations on this target. */
  listCapabilities(): Promise<Capability[]>;
}

export function publicIdHex(runtime: KeyhiveRuntime): string {
  return bytesToHex(runtime.Identifier.publicId().toBytes());
}

export function agentKindOf(agent: {
  isIndividual(): boolean;
  isGroup(): boolean;
  isDocument(): boolean;
}): AgentKind {
  if (agent.isIndividual()) return "individual";
  if (agent.isGroup()) return "group";
  if (agent.isDocument()) return "document";
  return "unknown";
}

/**
 * Membership of a keyhive document. `listMembers` reports the transitive
 * closure so the direct delegations are read separately to tell them apart.
 */
export function createDocumentTarget(
  runtime: KeyhiveRuntime,
  hive: AutomergeRepoKeyhiveBase,
  docUrl: AutomergeUrl
): PermissionTarget {
  const capabilities = async (): Promise<Capability[]> => {
    if (runtime.isUnprotectedDoc(docUrl)) return [];
    const doc = await hive.keyhive.getDocument(
      runtime.docIdFromAutomergeUrl(docUrl)
    );
    return doc ? await doc.members() : [];
  };

  return {
    kind: "document",
    key: docUrl,
    hive,
    runtime,
    supportsPublicAccess: true,

    async listMembers() {
      const members = await hive.listMembers(docUrl);
      // Nothing to compare against until the document is in keyhive.
      let directIds: Set<string> | null = null;
      try {
        const caps = await capabilities();
        if (caps.length > 0) {
          directIds = new Set(
            caps.map((cap) => bytesToHex(cap.who.id.toBytes()))
          );
        }
      } catch {
        directIds = null;
      }

      return members.map((member) => ({
        id: member.id,
        access: member.access,
        isSelf: member.isSelf,
        isPublic: member.isPublic,
        isSyncServer: member.isSyncServer,
        isDirect: directIds ? directIds.has(member.id) : true,
        // listMembers is already filtered to individuals by keyhive.
        kind: "individual" as const,
      }));
    },

    async addMember(contactCard, access) {
      await hive.addMemberToDoc(docUrl, contactCard, access);
    },

    async addAgent(agent, access) {
      const doc = await hive.keyhive.getDocument(
        runtime.docIdFromAutomergeUrl(docUrl)
      );
      if (!doc) {
        throw new Error("Document not found in keyhive. Has it synced yet?");
      }
      await hive.keyhive.addMember(agent, doc.toMembered(), access, []);
    },

    async removeMember(memberId) {
      await hive.revokeMemberFromDoc(docUrl, memberId);
    },

    async setPublicAccess(access) {
      await hive.setPublicAccess(docUrl, access);
    },

    listCapabilities: capabilities,
  };
}

export interface GroupTargetOptions {
  /** ARK tags the sync server for documents but not for groups. */
  syncServerId?: string;
}

/**
 * Membership of a keyhive group. Takes a live `Group` because `GroupId` has no
 * public constructor so a group cannot be looked up from a stored id.
 */
export function createGroupTarget(
  runtime: KeyhiveRuntime,
  hive: AutomergeRepoKeyhiveBase,
  group: Group,
  options: GroupTargetOptions = {}
): PermissionTarget {
  const selfHex = bytesToHex(hive.active.individual.id.toBytes());
  const publicHex = publicIdHex(runtime);

  const agentFor = async (memberId: string) => {
    const identifier = new runtime.Identifier(hexToBytes(memberId));
    const agent = await hive.keyhive.getAgent(identifier);
    if (!agent) {
      throw new Error(`Member not found in keyhive (id ${memberId})`);
    }
    return agent;
  };

  return {
    kind: "group",
    key: `group:${bytesToHex(group.id.toBytes())}`,
    hive,
    runtime,
    supportsPublicAccess: true,

    async listMembers() {
      const caps = await group.members();
      return caps.map((cap) => {
        const id = bytesToHex(cap.who.id.toBytes());
        return {
          id,
          access: cap.can,
          isSelf: id === selfHex,
          isPublic: id === publicHex,
          isSyncServer: options.syncServerId === id,
          isDirect: true,
          kind: agentKindOf(cap.who),
        };
      });
    },

    async addMember(contactCard, access) {
      await hive.receiveContactCard(contactCard);
      const agent = await hive.keyhive.getAgent(contactCard.id);
      if (!agent) {
        throw new Error(
          "That contact card did not resolve to a keyhive agent."
        );
      }
      await hive.keyhive.addMember(agent, group.toMembered(), access, []);
    },

    async addAgent(agent, access) {
      await hive.keyhive.addMember(agent, group.toMembered(), access, []);
    },

    async removeMember(memberId) {
      const agent = await agentFor(memberId);
      // Revoke only this member, leaving those they delegated to in place.
      await hive.keyhive.revokeMember(agent, true, group.toMembered());
    },

    async setPublicAccess(access) {
      const agent = await hive.keyhive.getAgent(runtime.Identifier.publicId());
      if (!agent) {
        throw new Error("The public agent is not present in keyhive.");
      }
      await hive.keyhive.addMember(agent, group.toMembered(), access, []);
    },

    async listCapabilities() {
      return await group.members();
    },
  };
}

/** The access levels `myAccess` can grant, lowest first. */
export function grantableLevels(
  runtime: KeyhiveRuntime,
  myAccess: Access | undefined
): Access[] {
  if (!myAccess) return [];
  const { Access: A } = runtime;
  return [A.relay(), A.read(), A.edit(), A.admin()].filter((level) =>
    myAccess.atLeast(level)
  );
}
