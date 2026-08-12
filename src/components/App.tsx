import keyhiveLogo from "../assets/honeybee.png";
import halAvatarUrl from "../assets/HAL-9000.webp";
import {
  isValidAutomergeUrl,
  type AutomergeUrl,
  useDocument,
} from "@automerge/react/slim";
import { TaskList } from "./TaskList";
import { DocumentList } from "./DocumentList";
import { useHash } from "react-use";
import { AvatarIcon } from "./AvatarIcon";
import { UserModal } from "./UserModal";
import { useState, useEffect, Component, type ReactNode } from "react";
import { Phonebook, PHONEBOOK_URL } from "../phonebook";
import { Identity } from "../active";
import { useReRenderOnDocProgress } from "../hooks";
import {
  AutomergeRepoKeyhive,
  uint8ArrayToHex,
  ContactCard,
} from "@automerge/automerge-repo-keyhive";
import * as syncServer from "../syncServer";
import { log } from "../log";

type AppProps = {
  docUrl: AutomergeUrl;
  automergeRepoKeyhive: AutomergeRepoKeyhive;
};

class ErrorBoundary extends Component<
  { children: ReactNode },
  { hasError: boolean }
> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error) {
    log.error("Caught error:", error);
  }

  render() {
    if (this.state.hasError) {
      return null;
    }
    return this.props.children;
  }
}

function App({ docUrl, automergeRepoKeyhive }: AppProps) {
  const [keyhiveUpdateTracker, setKeyhiveUpdateTracker] = useState(0);

  // Watch for keyhive updates - debounced to avoid excessive re-renders
  useEffect(() => {
    let timeoutId: number;
    const handler = () => {
      clearTimeout(timeoutId);
      timeoutId = window.setTimeout(() => {
        setKeyhiveUpdateTracker((v) => v + 1);
      }, 100);
    };

    // "update" fires for locally-originated keyhive changes; remote ops
    // arriving over sync signal "ingest-remote" on the network adapter.
    automergeRepoKeyhive.emitter.on("update", handler);
    automergeRepoKeyhive.networkAdapter.on("ingest-remote", handler);
    return () => {
      clearTimeout(timeoutId);
      automergeRepoKeyhive.emitter.off("update", handler);
      automergeRepoKeyhive.networkAdapter.off("ingest-remote", handler);
    };
  }, [automergeRepoKeyhive.emitter, automergeRepoKeyhive.networkAdapter]);

  // The phonebook is a shared doc that syncs from the server (or is seeded
  // locally on first run). Observe its load progress so
  // names and avatars (including the sync server's) appear once it arrives,
  // without a page reload.
  useReRenderOnDocProgress(PHONEBOOK_URL);
  const [identityState, setIdentityState] = useState<Identity>(() => ({
    active: automergeRepoKeyhive.active,
    contact: {
      peerId: automergeRepoKeyhive.active.peerId,
      avatar: null,
    },
  }));
  const [phonebook, changePhonebook] = useDocument<Phonebook>(PHONEBOOK_URL);

  // Load user's saved info from phonebook on startup
  useEffect(() => {
    if (phonebook && identityState.active.individual) {
      const userHexId = uint8ArrayToHex(
        identityState.active.individual.id.toBytes()
      );
      const savedContact = phonebook[userHexId];
      if (savedContact) {
        setIdentityState((prev) => ({
          ...prev,
          contact: {
            peerId: prev.contact.peerId,
            name: savedContact.name,
            avatar: savedContact.avatar,
          },
        }));
      }
    }
  }, [phonebook, identityState.active.individual]);

  // Give the sync server an avatar in the phonebook, so it is recognizable in
  // the share dialog's member list. Derived from the configured server.
  //
  // Only the avatar is stored. The name comes from syncServer.DISPLAY_NAME at
  // render time, because ARK already tells us which member is the sync server.
  useEffect(() => {
    if (!phonebook) return;
    const serverContactCard = ContactCard.fromJson(
      syncServer.CONTACT_CARD_JSON
    );
    if (!serverContactCard) return;
    const serverHexId = uint8ArrayToHex(serverContactCard.individualId.bytes);
    if (phonebook[serverHexId]) return;
    fetch(halAvatarUrl)
      .then((res) => res.arrayBuffer())
      .then((buffer) => {
        changePhonebook((doc) => {
          doc[serverHexId] = {
            peerId: syncServer.PEER_ID,
            avatar: new Uint8Array(buffer),
          };
        });
      })
      .catch((error) => {
        log.error("Could not load the sync server avatar:", error);
      });
  }, [phonebook, changePhonebook]);

  const [hash, setHash] = useHash();
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  // Remove the leading '#'
  const cleanHash = hash.slice(1);
  const selectedDocUrl =
    cleanHash && isValidAutomergeUrl(cleanHash)
      ? (cleanHash as AutomergeUrl)
      : null;

  return (
    <div className="flex w-screen h-screen overflow-hidden">
      {/* Sidebar */}
      <div className="w-80 border-r border-border bg-card">
        <DocumentList
          docUrl={docUrl}
          onSelectDocument={(url) => {
            if (url) {
              setHash(url);
            } else {
              setHash("");
            }
          }}
          selectedDocument={selectedDocUrl}
          hive={automergeRepoKeyhive}
        />
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col bg-muted">
        {/* Header */}
        <header className="p-6 border-b border-foreground/10 bg-muted flex justify-center relative">
          <h1 className="text-2xl font-semibold flex items-center text-foreground">
            <img src={keyhiveLogo} alt="Keyhive logo" id="keyhive-logo" />
            Keyhive Demo
          </h1>
          <div className="absolute right-6 top-1/2 -translate-y-1/2">
            <AvatarIcon
              onClick={() => setIsUserModalOpen(true)}
              identityState={identityState}
            />
          </div>
        </header>

        {/* Document */}
        <div className="flex-1 overflow-hidden">
          {selectedDocUrl ? (
            <ErrorBoundary key={selectedDocUrl}>
              <TaskList
                docUrl={selectedDocUrl}
                phonebook={phonebook}
                hive={automergeRepoKeyhive}
                identity={identityState}
                keyhiveUpdateTracker={keyhiveUpdateTracker}
              />
            </ErrorBoundary>
          ) : (
            <div className="flex items-center justify-center h-full text-muted-foreground bg-muted">
              Select or create a document from the sidebar
            </div>
          )}
        </div>
      </div>
      <UserModal
        isOpen={isUserModalOpen}
        onClose={() => setIsUserModalOpen(false)}
        identityState={identityState}
        setIdentityState={setIdentityState}
        changePhonebook={changePhonebook}
      />
    </div>
  );
}

export default App;
