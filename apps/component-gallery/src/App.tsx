import { useCallback, useMemo, useState } from "react";
import type { AutomergeUrl, Repo } from "@automerge/react/slim";
import type { AutomergeRepoKeyhive } from "@automerge/automerge-repo-keyhive";
import {
  AccountView,
  DirectoryProvider,
  PermissionsEditor,
  useKeyhiveUpdates,
} from "keyhive-react";
import { createLocalDirectory } from "./localDirectory";
import { keyhiveRuntime } from "./keyhiveRuntime";

interface AppProps {
  hive: AutomergeRepoKeyhive;
  repo: Repo;
}

/**
 * A gallery for the keyhive-react components, and a second consumer of the
 * package with no phonebook, no Tailwind configuration, and no shared code.
 */
export default function App({ hive, repo }: AppProps) {
  // Built once. This directory holds its own listeners.
  const directory = useMemo(() => createLocalDirectory(), []);

  return (
    <DirectoryProvider directory={directory}>
      <Gallery hive={hive} repo={repo} />
    </DirectoryProvider>
  );
}

function Gallery({ hive, repo }: AppProps) {
  const keyhiveVersion = useKeyhiveUpdates(hive);
  const [docUrl, setDocUrl] = useState<AutomergeUrl | null>(null);
  const [error, setError] = useState<string | null>(null);

  const createDocument = useCallback(async () => {
    setError(null);
    try {
      const handle = await repo.create2<{ title: string }>({
        title: "Gallery document",
      });
      await hive.addSyncServerRelayToDoc(handle.url);
      setDocUrl(handle.url);
    } catch (err) {
      setError(
        `Could not create a document: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }, [hive, repo]);

  return (
    <div className="page">
      <header className="page-header">
        <h1>keyhive-react gallery</h1>
        <p>
          A second consumer of the component library. No phonebook, no Tailwind
          setup, no shared code with the TODO demo.
        </p>
      </header>

      {error && (
        <p role="alert" className="page-error">
          {error}
        </p>
      )}

      <section>
        <h2>Account</h2>
        <p className="hint">
          Names are written to a localStorage directory rather than a shared
          document.
        </p>
        <AccountView hive={hive} />
      </section>

      <section>
        <h2>Document permissions</h2>
        {docUrl ? (
          <PermissionsEditor
            runtime={keyhiveRuntime}
            hive={hive}
            docUrl={docUrl}
            refreshToken={keyhiveVersion}
          />
        ) : (
          <button type="button" onClick={() => void createDocument()}>
            Create a document
          </button>
        )}
      </section>
    </div>
  );
}
