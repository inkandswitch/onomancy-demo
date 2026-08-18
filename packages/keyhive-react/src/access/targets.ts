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
   * would not take it away. Entries are direct unless a target says otherwise. */
  isDirect: boolean;
  kind: AgentKind;
}

/**
 * A keyhive document or group. ARK manages documents by `AutomergeUrl` but
 * does not currently manage groups, which go through `hive.keyhive` here.
 */
export interface AccessTarget {
  kind: "document" | "group";
  /** Stable string identifying the target for use as an effect dependency. */
  key: string;
  /** Hex-encoded keyhive id of the document or group itself. */
  subjectId: string;
  hive: AutomergeRepoKeyhiveBase;
  runtime: KeyhiveRuntime;
  supportsPublicAccess: boolean;
  /**
   * Who this target is shared with, one entry per direct delegation. A group
   * is one entry (individual group members are not listed here).
   */
  listMembers(): Promise<TargetMember[]>;
  /**
   * This identity's effective access, which {@link listMembers} does not
   * always show (e.g., when access is through a group). Undefined means no
   * access at all.
   */
  selfAccess(): Promise<Access | undefined>;
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
  /**
   * Grant access to whoever a directory entry names, which is what picking
   * someone out of a contact book does.
   *
   * Prefers the agent the local keyhive already holds, which is the only route
   * for a group, and falls back to the entry's contact card. Throws when
   * neither is available since a name alone carries no prekeys.
   */
  addDirectoryEntry(
    entry: { id: string; contactCard?: string },
    access: Access
  ): Promise<void>;
  setPublicAccess(access: Access): Promise<void>;
  /** The direct delegations on this target. */
  listCapabilities(): Promise<Capability[]>;
}

export function publicIdHex(runtime: KeyhiveRuntime): string {
  return bytesToHex(runtime.Identifier.publicId().toBytes());
}

interface TransitiveMember {
  who: { id: { toBytes(): Uint8Array } };
  can: Access;
}

function groupTransitiveMembers(
  group: Group
): Promise<TransitiveMember[]> | undefined {
  const withTransitive = group as unknown as {
    transitiveMembers?: () => Promise<TransitiveMember[]>;
  };
  return typeof withTransitive.transitiveMembers === "function"
    ? withTransitive.transitiveMembers()
    : undefined;
}

/** Shared implementation of {@link AccessTarget.addDirectoryEntry}. */
async function grantToDirectoryEntry(
  runtime: KeyhiveRuntime,
  hive: AutomergeRepoKeyhiveBase,
  entry: { id: string; contactCard?: string },
  access: Access,
  grant: {
    addAgent(agent: Agent, access: Access): Promise<void>;
    addMember(contactCard: ContactCard, access: Access): Promise<void>;
  }
): Promise<void> {
  const identifier = new runtime.Identifier(hexToBytes(entry.id));
  const agent = await hive.keyhive.getAgent(identifier);
  if (agent) {
    await grant.addAgent(agent, access);
    return;
  }
  if (entry.contactCard) {
    const card = runtime.ContactCard.fromJson(entry.contactCard);
    if (!card) {
      throw new Error("That contact card could not be read.");
    }
    await grant.addMember(card, access);
    return;
  }
  throw new Error(
    "Keyhive does not know this contact, and the directory holds no contact " +
      "card for them. Paste their contact card instead."
  );
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
 * Membership of a keyhive document.
 */
export function createDocumentTarget(
  runtime: KeyhiveRuntime,
  hive: AutomergeRepoKeyhiveBase,
  docUrl: AutomergeUrl
): AccessTarget {
  const capabilities = async (): Promise<Capability[]> => {
    if (runtime.isUnprotectedDoc(docUrl)) return [];
    const doc = await hive.keyhive.getDocument(
      runtime.docIdFromAutomergeUrl(docUrl)
    );
    return doc ? await doc.members() : [];
  };

  const docIdHex = () =>
    bytesToHex(runtime.docIdFromAutomergeUrl(docUrl).toBytes());

  /**
   * Filter out original group generated with document.
   */
  const isGeneratedOwnerGroup = (cap: Capability, docHex: string): boolean =>
    cap.who.isGroup() && bytesToHex(cap.proof.verifyingKey) === docHex;

  const addMemberToDoc = async (contactCard: ContactCard, access: Access) => {
    await hive.addMemberToDoc(docUrl, contactCard, access);
  };

  const addAgentToDoc = async (agent: Agent, access: Access) => {
    const doc = await hive.keyhive.getDocument(
      runtime.docIdFromAutomergeUrl(docUrl)
    );
    if (!doc) {
      throw new Error("Document not found in keyhive. Has it synced yet?");
    }
    await hive.keyhive.addMember(agent, doc.toMembered(), access, []);
  };

  return {
    kind: "document",
    key: docUrl,
    subjectId: docIdHex(),
    hive,
    runtime,
    supportsPublicAccess: true,

    async listMembers() {
      // Individuals, whichever path their access came from (e.g., direct or group).
      const reachable = await hive.listMembers(docUrl);
      const flags = new Map(reachable.map((member) => [member.id, member]));

      let caps: Capability[];
      try {
        caps = await capabilities();
      } catch {
        caps = [];
      }
      if (caps.length === 0) {
        return reachable.map((member) => ({
          ...member,
          isDirect: true,
          kind: "individual" as const,
        }));
      }

      const docHex = docIdHex();
      return caps
        .filter((cap) => !isGeneratedOwnerGroup(cap, docHex))
        .map((cap) => {
          const id = bytesToHex(cap.who.id.toBytes());
          const flagged = flags.get(id);
          const isSelf = flagged?.isSelf ?? false;
          return {
            id,
            access: cap.can,
            isSelf,
            isPublic: flagged?.isPublic ?? false,
            isSyncServer: flagged?.isSyncServer ?? false,
            isDirect: true,
            kind: isSelf ? ("individual" as const) : agentKindOf(cap.who),
          };
        });
    },

    async selfAccess() {
      const reachable = await hive.listMembers(docUrl);
      return reachable.find((member) => member.isSelf)?.access;
    },

    addMember: addMemberToDoc,

    addAgent: addAgentToDoc,

    async addDirectoryEntry(entry, access) {
      await grantToDirectoryEntry(runtime, hive, entry, access, {
        addAgent: addAgentToDoc,
        addMember: addMemberToDoc,
      });
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
): AccessTarget {
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

  const addAgentToGroup = async (agent: Agent, access: Access) => {
    await hive.keyhive.addMember(agent, group.toMembered(), access, []);
  };

  const addMemberToGroup = async (contactCard: ContactCard, access: Access) => {
    await hive.receiveContactCard(contactCard);
    const agent = await hive.keyhive.getAgent(contactCard.id);
    if (!agent) {
      throw new Error("That contact card did not resolve to a keyhive agent.");
    }
    await addAgentToGroup(agent, access);
  };

  return {
    kind: "group",
    key: `group:${bytesToHex(group.id.toBytes())}`,
    subjectId: bytesToHex(group.id.toBytes()),
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

    async selfAccess() {
      const transitive = groupTransitiveMembers(group);
      if (transitive) {
        const members = await transitive;
        return members.find(
          (member) => bytesToHex(member.who.id.toBytes()) === selfHex
        )?.can;
      }
      const caps = await group.members();
      return caps.find((cap) => bytesToHex(cap.who.id.toBytes()) === selfHex)
        ?.can;
    },

    addMember: addMemberToGroup,

    addAgent: addAgentToGroup,

    async addDirectoryEntry(entry, access) {
      await grantToDirectoryEntry(runtime, hive, entry, access, {
        addAgent: addAgentToGroup,
        addMember: addMemberToGroup,
      });
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
