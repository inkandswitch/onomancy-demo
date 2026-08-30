import keyhiveLogo from "../assets/honeybee.png";
import halAvatarUrl from "../assets/HAL-9000.webp";
import blankAvatarImg from "../assets/blankavatar.jpeg";
import {
  isValidAutomergeUrl,
  type AutomergeUrl,
  useDocument,
  useRepo,
} from "@automerge/react/slim";
import { TaskList } from "./TaskList";
import { DocumentList } from "./DocumentList";
import { GroupsPanel } from "./GroupsPanel";
import { useHash } from "react-use";
import { useEffect, useMemo, useRef, useState } from "react";
import { Phonebook, PHONEBOOK_NOTICE, PHONEBOOK_URL } from "../phonebook";
import {
  AccountView,
  Avatar,
  DirectoryProvider,
  Modal,
  useAutomergeDocDirectory,
  useDirectoryEntry,
  useKeyhiveUpdates,
  useReRenderOnDocProgress,
  useSelfIdentity,
} from "@automerge/keyhive-react";
import {
  createKeyhiveDesignation,
  useOnomancyDirectory,
} from "@automerge/keyhive-react/onomancy";
import { keyhiveRuntime } from "../keyhiveRuntime";
import { onomancyRuntime } from "../onomancyRuntime";
import { AutomergeRepoKeyhive } from "@automerge/automerge-repo-keyhive";
import { useNamestore } from "../namestore";
import * as syncServer from "../syncServer";
import { errorMessage, log } from "../log";
import { ErrorBoundary } from "./ErrorBoundary";
import { NameBox } from "./NameBox";
import { NamestorePanel } from "./NamestorePanel";
import { describePartial } from "../names";
import { useNameRoute } from "../useNameRoute";
import { inviteFromHash, redeemInviteLink } from "../invite";

type AppProps = {
  docUrl: AutomergeUrl;
  automergeRepoKeyhive: AutomergeRepoKeyhive;
};

/**
 * Point the location hash at `newHash` without adding a history entry.
 *
 * A redemption ends by replacing an `#invite=` fragment, and that fragment
 * carries the invite identity's private key. Assigning `location.hash` would
 * push, leaving the key in the session history, which would mean pressing back
 * would cause a second redemption attempt.
 */
function replaceHash(newHash: string): void {
  window.history.replaceState(null, "", `#${newHash}`);
  window.dispatchEvent(new HashChangeEvent("hashchange"));
}

/** Builds the name directory everything renders peers through. */
function App({ docUrl, automergeRepoKeyhive }: AppProps) {
  // The phonebook syncs from the server or is created locally on first run.
  // Watching its progress makes names appear without a reload.
  useReRenderOnDocProgress(useRepo(), PHONEBOOK_URL);
  const [phonebook, changePhonebook] = useDocument<Phonebook>(PHONEBOOK_URL);

  const baseDirectory = useAutomergeDocDirectory(phonebook, changePhonebook, {
    source: "phonebook",
    notice: PHONEBOOK_NOTICE,
  });

  // A domain binds a namestore document, and that document's admins are the
  // ones it speaks for. The keyhive designation checks exactly that, and also
  // accepts the solo case where a domain binds an identity's own key, so both
  // anchor shapes verify.
  //
  // Memoized because useOnomancyDirectory keys its verdict cache on the base
  // directory identity: a fresh designation on every render would not rebuild
  // the wrapper, but a fresh base would throw the cache away.
  const designation = useMemo(
    () => createKeyhiveDesignation(keyhiveRuntime, automergeRepoKeyhive),
    [automergeRepoKeyhive]
  );

  // Decorates entries claiming a dnsName with a verification status. Claims
  // without the wrapper render as claims: no stronger than a display name.
  const directory = useOnomancyDirectory(baseDirectory, onomancyRuntime, {
    designation,
  });

  // Give the sync server an avatar so it is recognizable in the member list.
  // Its name comes from syncServer.DISPLAY_NAME, since ARK already tells us
  // which member it is.
  useEffect(() => {
    if (!phonebook || !directory.publish) return;
    const serverHexId = syncServer.identifierHex();
    if (!serverHexId || phonebook[serverHexId]) return;
    fetch(halAvatarUrl)
      .then((res) => res.arrayBuffer())
      .then((buffer) => {
        void directory.publish?.({
          id: serverHexId,
          peerId: syncServer.PEER_ID,
          avatar: new Uint8Array(buffer),
        });
      })
      .catch((error) => {
        log.error("Could not load the sync server avatar:", error);
      });
  }, [phonebook, directory]);

  return (
    <DirectoryProvider directory={directory}>
      <AppShell docUrl={docUrl} automergeRepoKeyhive={automergeRepoKeyhive} />
    </DirectoryProvider>
  );
}

function AppShell({ docUrl, automergeRepoKeyhive }: AppProps) {
  const repo = useRepo();
  const namestore = useNamestore(repo, automergeRepoKeyhive);
  const keyhiveVersion = useKeyhiveUpdates(automergeRepoKeyhive);
  const self = useSelfIdentity(automergeRepoKeyhive);
  const selfEntry = useDirectoryEntry(self.id);

  const [hash, setHash] = useHash();
  const [isAccountModalOpen, setIsAccountModalOpen] = useState(false);
  const cleanHash = hash.slice(1);
  const directDocUrl =
    cleanHash && isValidAutomergeUrl(cleanHash)
      ? (cleanHash as AutomergeUrl)
      : null;

  // A hash that is neither a document id nor an invite may be a name. The
  // resolved document opens exactly as a pasted id would, so a name is a
  // shareable URL rather than a second way of navigating.
  const nameRoute = useNameRoute(repo, hash, namestore.url);
  const selectedDocUrl =
    directDocUrl ?? (nameRoute.status === "resolved" ? nameRoute.url : null);

  // An `#invite=` hash means this tab was opened from an invite link. Redeem it
  // and then point the hash at the document, which is what adds it to the
  // sidebar and opens it.
  const [joinError, setJoinError] = useState<string | null>(null);
  const [isJoining, setIsJoining] = useState(false);
  const [joinAttempt, setJoinAttempt] = useState<{
    n: number;
    of: number;
  } | null>(null);
  // The invite currently being redeemed. Cleared when that redemption settles.
  const redeeming = useRef<string | null>(null);
  useEffect(() => {
    const invite = inviteFromHash(hash);
    if (!invite) {
      // A redemption may still be running, but nothing is waiting on it now.
      setIsJoining(false);
      setJoinError(null);
      setJoinAttempt(null);
      return;
    }

    if (redeeming.current === hash) return;
    redeeming.current = hash;

    let cancelled = false;
    setIsJoining(true);
    setJoinError(null);
    redeemInviteLink(
      automergeRepoKeyhive,
      repo,
      invite,
      automergeRepoKeyhive.active.contactCard,
      {
        onAttempt: (n, of) => {
          if (!cancelled) setJoinAttempt({ n, of });
        },
      }
    )
      .then((joinedDocUrl) => {
        if (!cancelled) replaceHash(joinedDocUrl);
      })
      .catch((error) => {
        log.error("Could not join from the invite link:", error);
        if (!cancelled) setJoinError(errorMessage(error));
      })
      .finally(() => {
        redeeming.current = null;
        if (!cancelled) setIsJoining(false);
      });

    return () => {
      cancelled = true;
    };
  }, [hash, automergeRepoKeyhive, repo]);

  return (
    <div className="flex w-screen h-screen overflow-hidden">
      <div className="w-80 border-r border-border bg-card flex flex-col">
        <div className="flex-1 min-h-0">
          <DocumentList
            docUrl={docUrl}
            onSelectDocument={(url) => setHash(url ?? "")}
            selectedDocument={selectedDocUrl}
            hive={automergeRepoKeyhive}
            namestoreUrl={namestore.url}
          />
        </div>
        <div className="p-4 border-t border-border">
          <h2 className="text-sm font-medium text-foreground mb-3">
            Open by name
          </h2>
          <NameBox onResolve={(name) => setHash(name)} />
        </div>
        <GroupsPanel
          hive={automergeRepoKeyhive}
          keyhiveVersion={keyhiveVersion}
        />
      </div>

      <div className="flex-1 flex flex-col bg-muted">
        <header className="p-6 border-b border-foreground/10 bg-muted flex justify-center relative">
          <h1 className="text-2xl font-semibold flex items-center text-foreground">
            <img src={keyhiveLogo} alt="Keyhive logo" id="keyhive-logo" />
            Keyhive Demo
          </h1>
          <div className="absolute right-6 top-1/2 -translate-y-1/2">
            <button
              onClick={() => setIsAccountModalOpen(true)}
              className="flex items-center justify-center w-10 h-10 rounded-full bg-secondary hover:bg-accent transition-colors duration-200 border-2 border-transparent hover:border-border focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
              aria-label="User profile"
            >
              <Avatar
                avatar={selfEntry?.avatar}
                name={selfEntry?.name}
                sizeClassName="w-full h-full"
                fallbackSrc={blankAvatarImg}
              />
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-hidden">
          {selectedDocUrl ? (
            <ErrorBoundary key={selectedDocUrl}>
              <TaskList
                docUrl={selectedDocUrl}
                hive={automergeRepoKeyhive}
                keyhiveVersion={keyhiveVersion}
              />
            </ErrorBoundary>
          ) : nameRoute.status === "resolving" ? (
            <div className="flex items-center justify-center h-full text-muted-foreground bg-muted">
              Resolving {nameRoute.name.value}...
            </div>
          ) : nameRoute.status === "partial" ? (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground bg-muted px-6 text-center gap-2">
              <p className="font-mono text-foreground">
                {nameRoute.name.value}
              </p>
              <p className="max-w-prose">
                {describePartial(nameRoute.resolution)}
              </p>
            </div>
          ) : nameRoute.status === "error" ? (
            <div
              role="alert"
              className="flex flex-col items-center justify-center h-full text-destructive bg-muted px-6 text-center gap-2"
            >
              <p className="font-mono">{nameRoute.raw}</p>
              <p className="max-w-prose">{nameRoute.message}</p>
            </div>
          ) : isJoining ? (
            <div className="flex items-center justify-center h-full text-muted-foreground bg-muted">
              Joining the shared list from your invite link...
              {joinAttempt && joinAttempt.n > 1
                ? ` (attempt ${joinAttempt.n} of ${joinAttempt.of})`
                : ""}
            </div>
          ) : joinError ? (
            <div
              role="alert"
              className="flex items-center justify-center h-full text-destructive bg-muted px-6 text-center"
            >
              Could not join from the invite link: {joinError}
            </div>
          ) : (
            <div className="flex items-center justify-center h-full text-muted-foreground bg-muted">
              Select or create a document from the sidebar
            </div>
          )}
        </div>
      </div>

      <Modal
        isOpen={isAccountModalOpen}
        onClose={() => setIsAccountModalOpen(false)}
        title="User Profile"
      >
        {/*
          showDnsName is explicit rather than left to its default because the
          phonebook is unencrypted and writable by anyone holding its id, so a
          claim stored in it is forgeable. That is survivable, and is the point
          of verifying: a forged claim reads `mismatch` or `unreachable`, never
          `verified`, because the badge comes from a DNSSEC chain rather than
          from the document. An attacker can write any claim they like and
          still cannot produce a verified one.
        */}
        <AccountView
          hive={automergeRepoKeyhive}
          onSaved={() => setIsAccountModalOpen(false)}
          onCancel={() => setIsAccountModalOpen(false)}
          showDnsName
          // Without this the field canonicalises spelling but cannot tell a
          // hostname from a typo, so a bad claim is stored and only shows up as
          // `invalid` once something tries to verify it. Passing the runtime's
          // version rejects it at entry against onomancy's real grammar.
          normalizeDnsName={onomancyRuntime.normalizeDnsName}
          publishContactCard
          fallbackAvatarSrc={blankAvatarImg}
        />

        <div className="mt-6 pt-6 border-t border-border">
          <h3 className="text-sm font-medium text-foreground mb-3">
            Namestore
          </h3>
          <NamestorePanel
            namestoreUrl={namestore.url}
            hive={automergeRepoKeyhive}
            keyhiveVersion={keyhiveVersion}
          />
        </div>
      </Modal>
    </div>
  );
}

export default App;
