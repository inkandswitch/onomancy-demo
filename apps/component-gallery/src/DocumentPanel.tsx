import { useEffect, useState } from "react";
import {
  isValidAutomergeUrl,
  updateText,
  useDocument,
  useRepo,
  type AutomergeUrl,
} from "@automerge/react/slim";
import type {
  Access,
  AutomergeRepoKeyhive,
} from "@automerge/automerge-repo-keyhive";
import { CopyableField, useReRenderOnDocProgress } from "keyhive-react";

export interface GalleryDoc {
  title: string;
}

interface DocumentPanelProps {
  hive: AutomergeRepoKeyhive;
  docUrl: AutomergeUrl;
  keyhiveVersion: number;
}

/**
 * The document's id, its contents, and our access to it.
 */
export function DocumentPanel({
  hive,
  docUrl,
  keyhiveVersion,
}: DocumentPanelProps) {
  useReRenderOnDocProgress(useRepo(), docUrl);
  const [doc, changeDoc] = useDocument<GalleryDoc>(docUrl);
  const [access, setAccess] = useState<Access | undefined>();
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const best = await hive.bestAccessForDoc(
          hive.active.individual.id,
          docUrl
        );
        if (!cancelled) setAccess(best);
      } finally {
        if (!cancelled) setChecked(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [hive, docUrl, keyhiveVersion]);

  const canRead = access?.isReader ?? false;
  const canEdit = access?.isEditor ?? false;

  return (
    <>
      <CopyableField
        label="Document id"
        value={docUrl}
        help="Paste this into another browser profile to open the same document."
      />

      <p className="hint" style={{ marginTop: "1rem" }}>
        Your access: <strong>{access ? access.toString() : "none"}</strong>
        {!checked && " (checking)"}
      </p>

      {canRead && doc ? (
        <input
          type="text"
          value={doc.title}
          disabled={!canEdit}
          onChange={(e) =>
            changeDoc((d) => updateText(d, ["title"], e.target.value))
          }
          aria-label="Document title"
          style={{ width: "100%", padding: "0.5rem", font: "inherit" }}
        />
      ) : (
        <p className="hint">
          {checked && !canRead
            ? "You cannot read this document."
            : "Loading the document..."}
        </p>
      )}
    </>
  );
}

interface LoadDocumentProps {
  onLoad: (docUrl: AutomergeUrl) => void;
}

/** Opens a document by id. */
export function LoadDocument({ onLoad }: LoadDocumentProps) {
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const trimmed = input.trim();
        if (!trimmed) return;
        const url = trimmed.startsWith("automerge:")
          ? trimmed
          : `automerge:${trimmed}`;
        if (!isValidAutomergeUrl(url)) {
          setError("That is not a valid Automerge document id.");
          return;
        }
        setError(null);
        setInput("");
        onLoad(url as AutomergeUrl);
      }}
      style={{ display: "flex", gap: "0.5rem", marginTop: "0.75rem" }}
    >
      <input
        type="text"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        placeholder="Document id"
        aria-label="Document id"
        style={{ flex: 1, padding: "0.5rem", font: "inherit" }}
      />
      <button type="submit">Load</button>
      {error && (
        <p role="alert" className="page-error">
          {error}
        </p>
      )}
    </form>
  );
}
