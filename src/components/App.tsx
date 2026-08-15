import keyhiveLogo from "../assets/honeybee.png";
import halAvatarUrl from "../assets/HAL-9000.webp";
import blankAvatarImg from "../assets/blankavatar.jpeg";
import {
  isValidAutomergeUrl,
  type AutomergeUrl,
  type PeerId,
  useDocument,
} from "@automerge/react/slim";
import { TaskList } from "./TaskList";
import { DocumentList } from "./DocumentList";
import { useHash } from "react-use";
import { useCallback, useEffect, useState } from "react";
import { Phonebook, PHONEBOOK_URL } from "../phonebook";
import {
  AccountView,
  Avatar,
  Modal,
  useKeyhiveUpdates,
  useReRenderOnDocProgress,
  useSelfIdentity,
  type Contact,
} from "keyhive-react";
import {
  AutomergeRepoKeyhive,
  ContactCard,
  uint8ArrayToHex,
} from "@automerge/automerge-repo-keyhive";
import * as syncServer from "../syncServer";
import { log } from "../log";
import { ErrorBoundary } from "./ErrorBoundary";

type AppProps = {
  docUrl: AutomergeUrl;
  automergeRepoKeyhive: AutomergeRepoKeyhive;
};

function App({ docUrl, automergeRepoKeyhive }: AppProps) {
  const keyhiveVersion = useKeyhiveUpdates(automergeRepoKeyhive);
  const self = useSelfIdentity(automergeRepoKeyhive);

  // The phonebook syncs from the server or is created locally on first run.
  // Watching its progress makes names appear without a reload.
  useReRenderOnDocProgress(PHONEBOOK_URL);
  const [phonebook, changePhonebook] = useDocument<Phonebook>(PHONEBOOK_URL);

  const saveContact = useCallback(
    (id: string, contact: Contact) => {
      changePhonebook?.((doc) => {
        const existing = doc[id];
        if (!existing) {
          doc[id] = {
            peerId: contact.peerId as PeerId,
            name: contact.name,
            avatar: contact.avatar ?? null,
          };
          return;
        }
        if (contact.name !== undefined) existing.name = contact.name;
        if (contact.avatar !== undefined) {
          existing.avatar = contact.avatar ?? null;
        }
      });
    },
    [changePhonebook]
  );

  // Give the sync server an avatar so it is recognizable in the member list.
  // Its name comes from syncServer.DISPLAY_NAME, since ARK already tells us
  // which member it is.
  useEffect(() => {
    if (!phonebook || !changePhonebook) return;
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
  const [isAccountModalOpen, setIsAccountModalOpen] = useState(false);
  const cleanHash = hash.slice(1);
  const selectedDocUrl =
    cleanHash && isValidAutomergeUrl(cleanHash)
      ? (cleanHash as AutomergeUrl)
      : null;

  const selfEntry = phonebook?.[self.id];

  return (
    <div className="flex w-screen h-screen overflow-hidden">
      <div className="w-80 border-r border-border bg-card">
        <DocumentList
          docUrl={docUrl}
          onSelectDocument={(url) => setHash(url ?? "")}
          selectedDocument={selectedDocUrl}
          hive={automergeRepoKeyhive}
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
                phonebook={phonebook}
                hive={automergeRepoKeyhive}
                keyhiveVersion={keyhiveVersion}
              />
            </ErrorBoundary>
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
        <AccountView
          hive={automergeRepoKeyhive}
          contacts={phonebook}
          onSave={saveContact}
          onSaved={() => setIsAccountModalOpen(false)}
          onCancel={() => setIsAccountModalOpen(false)}
          fallbackAvatarSrc={blankAvatarImg}
        />
      </Modal>
    </div>
  );
}

export default App;
