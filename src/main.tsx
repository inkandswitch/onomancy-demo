import ReactDOM from "react-dom/client";
import "./index.css";
// The Repo's subduction subsystem uses the slim subduction entry, which does
// not self-initialize its WASM. Importing the full entry initializes the
// shared module instance.
import "@automerge/automerge-subduction";
import {
  initializeAutomergeRepoKeyhive,
  AutomergeRepoKeyhive,
} from "@automerge/automerge-repo-keyhive";
import { Repo } from "@automerge/automerge-repo";
import { IndexedDBStorageAdapter } from "@automerge/automerge-repo-storage-indexeddb";
import Frame from "./components/Frame.tsx";
import { ensurePhonebook } from "./phonebook.ts";
import * as syncServer from "./syncServer.ts";

declare global {
  interface Window {
    hive: AutomergeRepoKeyhive;
    repo: Repo;
  }
}

async function start() {
  const storage = new IndexedDBStorageAdapter();

  const { hive, repo } = await initializeAutomergeRepoKeyhive({
    createRepo: (config) => new Repo(config),
    storage,
    // ARK appends a random component for peer uniqueness, so a plain label is
    // all the demo needs to pass.
    peerIdSuffix: "keyhive-demo",
    automaticArchiveIngestion: true,
    cachingMode: "periodic",
    syncServer: syncServer.SELECTION,
    repo: {
      storage,
      subductionWebsocketEndpoints: [syncServer.ENDPOINT],
      enableRemoteHeadsGossiping: true,
    },
  });

  // Debug handles.
  window.hive = hive;
  window.repo = repo;

  // Seed the shared phonebook if the sync server does not already have it (for
  // example a freshly started server). Fire-and-forget: the UI renders now and
  // picks up the phonebook once it loads or is seeded.
  void ensurePhonebook(repo);

  const rootElement = document.getElementById("root");
  if (!rootElement) {
    throw new Error("Root element not found");
  }

  const root = ReactDOM.createRoot(rootElement);
  root.render(<Frame automergeRepoKeyhive={hive} repo={repo} />);
}

start().catch((error) => {
  console.error("[Demo] Failed to start:", error);
});
