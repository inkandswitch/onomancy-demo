import { useMemo } from "react";
import { AutomergeUrl } from "@automerge/react/slim";
import {
  AutomergeRepoKeyhive,
  uint8ArrayToHex,
} from "@automerge/automerge-repo-keyhive";
import { CopyableField } from "@automerge/keyhive-react";
import { keyhiveRuntime } from "../keyhiveRuntime";
import { bindingRecord } from "../onomancy";

interface NamestorePanelProps {
  namestoreUrl: AutomergeUrl | null;
  hive: AutomergeRepoKeyhive;
}

/**
 * The namestore's id and the DNS record that binds a domain to it.
 *
 * Publishing the record is what turns `~/todos/groceries` into
 * `@yourdomain/todos/groceries` for everyone else. Nothing about the documents
 * changes when a domain is added: the name is a second spelling of an identity
 * that already had one, which is the property that makes a binding safe to add
 * late and safe to leave off.
 */
export function NamestorePanel({ namestoreUrl, hive }: NamestorePanelProps) {
  const record = useMemo(() => {
    if (!namestoreUrl) return null;
    const documentId = keyhiveRuntime
      .docIdFromAutomergeUrl(namestoreUrl)
      .toBytes();
    return bindingRecord(hive.active.individual.id.toBytes(), documentId);
  }, [namestoreUrl, hive]);

  if (!namestoreUrl) {
    return (
      <p className="text-sm text-muted-foreground">
        Preparing this identity's namestore...
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Your names live in this document. Whoever holds admin on it can bind
        names in it, so sharing the name is sharing the document.
      </p>

      <CopyableField
        label="Namestore id"
        value={namestoreUrl}
        help="Share this to let someone else read, or with admin access write, your names."
      />

      {record && (
        <CopyableField
          label="DNS record"
          value={record}
          help={`Publish as a TXT record at _onomancy.<your-domain>. Once it is signed by DNSSEC, ${uint8ArrayToHex(
            hive.active.individual.id.toBytes()
          ).slice(0, 8)}... speaks for that domain.`}
        />
      )}

      <p className="text-xs text-muted-foreground">
        The record names the document, not you. Ownership of the name is whoever
        the document grants admin to, so it is shared by inviting another admin
        rather than by editing DNS again.
      </p>
    </div>
  );
}
