import ReactDOM from "react-dom/client";
// The Repo's subduction subsystem uses the slim subduction entry, which does
// not self-initialize its WASM. Importing the full entry initializes the
// shared module instance.
import "@automerge/automerge-subduction";
import { initializeAutomergeRepoKeyhive } from "@automerge/automerge-repo-keyhive";
// eslint-disable-next-line automerge-slimport/enforce-automerge-slim-import
import { Repo } from "@automerge/automerge-repo";
import { IndexedDBStorageAdapter } from "@automerge/automerge-repo-storage-indexeddb";
import { RepoContext } from "@automerge/react/slim";
// The only CSS the components need. This app has no Tailwind of its own.
import "@automerge/keyhive-react/styles.css";
import "./app.css";
import App from "./App";

async function start() {
  const storage = new IndexedDBStorageAdapter("keyhive-test-app");

  const { hive, repo } = await initializeAutomergeRepoKeyhive({
    createRepo: (config) => new Repo(config),
    storage,
    peerIdSuffix: "keyhive-test-app",
    automaticArchiveIngestion: true,
    cachingMode: "periodic",
    syncServer: "keyhive",
    repo: {
      storage,
      subductionWebsocketEndpoints: ["wss://keyhive.sync.automerge.org"],
      enableRemoteHeadsGossiping: true,
    },
  });

  const rootElement = document.getElementById("root");
  if (!rootElement) throw new Error("Root element not found");

  ReactDOM.createRoot(rootElement).render(
    <RepoContext.Provider value={repo}>
      <App hive={hive} repo={repo} />
    </RepoContext.Provider>
  );
}

start().catch((error) => {
  console.error("Failed to start:", error);
});
