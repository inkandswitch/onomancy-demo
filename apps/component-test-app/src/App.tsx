import { useCallback, useMemo, useState } from "react";
import type { AutomergeUrl, Repo } from "@automerge/react/slim";
import type {
  AutomergeRepoKeyhive,
  Group,
} from "@automerge/automerge-repo-keyhive";
import {
  AccountView,
  createDocumentTarget,
  createGroupTarget,
  DirectoryProvider,
  PermissionsEditor,
  useKeyhiveUpdates,
} from "keyhive-react";
import { DocumentPanel, LoadDocument } from "./DocumentPanel";
import { createLocalDirectory } from "./localDirectory";
import { keyhiveRuntime } from "./keyhiveRuntime";

interface AppProps {
  hive: AutomergeRepoKeyhive;
  repo: Repo;
}

/**
 * A test app for the keyhive-react components, and a second consumer of the
 * package with no phonebook, no Tailwind configuration, and no shared code.
 */
export default function App({ hive, repo }: AppProps) {
  // Built once. This directory holds its own listeners.
  const directory = useMemo(() => createLocalDirectory(), []);

  return (
    <DirectoryProvider directory={directory}>
      <TestApp hive={hive} repo={repo} />
    </DirectoryProvider>
  );
}

function TestApp({ hive, repo }: AppProps) {
  const keyhiveVersion = useKeyhiveUpdates(hive);
  const [docUrl, setDocUrl] = useState<AutomergeUrl | null>(null);
  const [group, setGroup] = useState<Group | null>(null);
  const [error, setError] = useState<string | null>(null);

  const createDocument = useCallback(async () => {
    setError(null);
    try {
      const handle = await repo.create2<{ title: string }>({
        title: "Test app document",
      });
      await hive.addSyncServerRelayToDoc(handle.url);
      setDocUrl(handle.url);
    } catch (err) {
      setError(
        `Could not create a document: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }, [hive, repo]);

  const createGroup = useCallback(async () => {
    setError(null);
    try {
      // ARK does not currently expose group generation so this goes through
      // the raw Keyhive.
      setGroup(await hive.keyhive.generateGroup([]));
    } catch (err) {
      setError(
        `Could not create a group: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }, [hive]);

  const documentTarget = useMemo(
    () => (docUrl ? createDocumentTarget(keyhiveRuntime, hive, docUrl) : null),
    [hive, docUrl]
  );
  const groupTarget = useMemo(
    () => (group ? createGroupTarget(keyhiveRuntime, hive, group) : null),
    [hive, group]
  );

  const addGroupToDocument = useCallback(async () => {
    setError(null);
    if (!documentTarget || !group) return;
    try {
      // A group has no contact card so it is added as an agent.
      await documentTarget.addAgent(
        group.toAgent(),
        keyhiveRuntime.Access.edit()
      );
    } catch (err) {
      setError(
        `Could not add the group: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }, [documentTarget, group]);

  return (
    <div className="page">
      <header className="page-header">
        <h1>keyhive-react test app</h1>
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
        <h2>Document</h2>
        {docUrl ? (
          <DocumentPanel
            hive={hive}
            docUrl={docUrl}
            keyhiveVersion={keyhiveVersion}
          />
        ) : (
          <>
            <p className="hint">
              Create a new document or load one another profile has shared.
            </p>
            <button type="button" onClick={() => void createDocument()}>
              Create a document
            </button>
          </>
        )}
        <LoadDocument onLoad={setDocUrl} />
      </section>

      <section>
        <h2>Document access</h2>
        {documentTarget ? (
          <PermissionsEditor
            target={documentTarget}
            refreshToken={keyhiveVersion}
          />
        ) : (
          <p className="hint">No document yet.</p>
        )}
      </section>

      <section>
        <h2>Group access</h2>
        <p className="hint">
          Set access levels of members in a group.
        </p>
        {groupTarget ? (
          <>
            <PermissionsEditor
              target={groupTarget}
              refreshToken={keyhiveVersion}
            />
            <button
              type="button"
              className="plain-button"
              disabled={!documentTarget}
              onClick={() => void addGroupToDocument()}
            >
              Delegate this group edit access to the document
            </button>
          </>
        ) : (
          <button type="button" onClick={() => void createGroup()}>
            Create a group
          </button>
        )}
      </section>
    </div>
  );
}
