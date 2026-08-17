import { useMemo, useState } from "react";
import { shortId, useDirectory } from "../directory/context";
import type { DirectoryEntry, DirectoryEntryKind } from "../directory/types";
import { Avatar } from "./primitives/Avatar";

export interface ContactBookProps {
  /** Called with the entry the reader picked. */
  onSelect: (entry: DirectoryEntry) => void;
  /** Ids to leave out, such as the people a document is already shared with. */
  excludeIds?: readonly string[];
  /** Show only these kinds. Entries with no recorded kind always show. */
  kinds?: readonly DirectoryEntryKind[];
  placeholder?: string;
  /** Shown when the directory has nothing left to offer. */
  emptyMessage?: string;
  /** Entries to render before the reader has typed. Zero shows all of them. */
  initialLimit?: number;
  fallbackAvatarSrc?: string;
  className?: string;
}

function matches(entry: DirectoryEntry, query: string): boolean {
  if (!query) return true;
  const needle = query.toLowerCase();
  return (
    (entry.name?.toLowerCase().includes(needle) ?? false) ||
    entry.id.toLowerCase().startsWith(needle)
  );
}

/**
 * Search the name directory for a person or a group, and pick one.
 *
 * Everything here is as trustworthy as the directory behind it, which is
 * usually not very since names are self-asserted. The id is displayed for that
 * reason.
 */
export function ContactBook({
  onSelect,
  excludeIds = [],
  kinds,
  placeholder = "Search by name",
  emptyMessage = "Nobody to show yet.",
  initialLimit = 8,
  fallbackAvatarSrc,
  className = "",
}: ContactBookProps) {
  const directory = useDirectory();
  const [query, setQuery] = useState("");

  const excluded = useMemo(() => new Set(excludeIds), [excludeIds]);

  const entries = useMemo(() => {
    const wanted = kinds ? new Set(kinds) : null;
    return (
      directory
        .list()
        .filter((entry) => !excluded.has(entry.id))
        // An entry written before kinds were recorded is not evidence of the
        // wrong kind, so it stays.
        .filter((entry) => !wanted || !entry.kind || wanted.has(entry.kind))
        .filter((entry) => matches(entry, query))
        .sort((a, b) =>
          (a.name ?? a.id).localeCompare(b.name ?? b.id, undefined, {
            sensitivity: "base",
          })
        )
    );
  }, [directory, excluded, kinds, query]);

  const shown =
    query || initialLimit === 0 ? entries : entries.slice(0, initialLimit);

  if (!directory.enumerable) {
    return (
      <p className={`kh-text-sm kh-text-muted-foreground ${className}`}>
        This name directory cannot be listed, so there is nothing to search.
      </p>
    );
  }

  return (
    <div className={`kh-space-y-2 ${className}`}>
      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        className="kh-w-full kh-px-3 kh-py-2 kh-border kh-border-border kh-rounded-md kh-shadow-sm focus:kh-outline-none focus:kh-ring-2 focus:kh-ring-ring focus:kh-border-ring kh-text-sm kh-bg-background kh-text-foreground"
      />

      {shown.length === 0 ? (
        <p className="kh-text-sm kh-text-muted-foreground">
          {query ? "No matches." : emptyMessage}
        </p>
      ) : (
        <ul className="kh-space-y-1 kh-max-h-64 kh-overflow-y-auto kh-list-none kh-p-0 kh-m-0">
          {shown.map((entry) => (
            <li key={entry.id}>
              <button
                type="button"
                onClick={() => onSelect(entry)}
                className="kh-w-full kh-flex kh-items-center kh-gap-3 kh-px-3 kh-py-2 kh-rounded-md hover:kh-bg-accent focus:kh-outline-none focus:kh-ring-2 focus:kh-ring-ring kh-text-left kh-transition-colors"
              >
                <Avatar
                  avatar={entry.avatar}
                  name={entry.name ?? entry.id}
                  fallbackSrc={fallbackAvatarSrc}
                />
                <span className="kh-min-w-0">
                  <span className="kh-block kh-text-sm kh-font-medium kh-text-foreground kh-truncate">
                    {entry.name ?? shortId(entry.id)}
                    {entry.kind === "group" && (
                      <span className="kh-ml-2 kh-text-xs kh-text-muted-foreground">
                        (group)
                      </span>
                    )}
                  </span>
                  <span className="kh-block kh-text-xs kh-text-muted-foreground kh-font-mono kh-truncate">
                    {shortId(entry.id)}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {!query && entries.length > shown.length && (
        <p className="kh-text-xs kh-text-muted-foreground">
          {entries.length - shown.length} more. Type to narrow the list.
        </p>
      )}
    </div>
  );
}
