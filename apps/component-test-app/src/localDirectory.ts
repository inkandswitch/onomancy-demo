import type { DirectoryEntry, NameDirectory } from "keyhive-react";

/**
 * A name directory kept in localStorage. Its contents live outside React so it
 * notifies through `subscribe`.
 */

const STORAGE_KEY = "keyhive-test-app-directory";

/** Avatars are bytes and localStorage holds strings, so this uses base64. */
interface StoredEntry {
  name?: string;
  peerId?: string;
  avatarBase64?: string;
}

type StoredDirectory = Record<string, StoredEntry>;

function read(): StoredDirectory {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as StoredDirectory) : {};
  } catch {
    return {};
  }
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export function createLocalDirectory(): NameDirectory {
  const listeners = new Set<() => void>();
  let stored = read();

  // Keyed by the base64 it came from, so lookup returns a stable reference.
  const avatarCache = new Map<string, Uint8Array>();

  function decodeAvatar(base64: string | undefined): Uint8Array | null {
    if (!base64) return null;
    const cached = avatarCache.get(base64);
    if (cached) return cached;
    const bytes = base64ToBytes(base64);
    avatarCache.set(base64, bytes);
    return bytes;
  }

  function toEntry(id: string, record: StoredEntry): DirectoryEntry {
    return {
      id,
      name: record.name,
      peerId: record.peerId,
      avatar: decodeAvatar(record.avatarBase64),
    };
  }

  function notify() {
    for (const listener of listeners) listener();
  }

  // Does not fire in the tab that made the change, so publish notifies too.
  window.addEventListener("storage", (event) => {
    if (event.key !== STORAGE_KEY) return;
    stored = read();
    notify();
  });

  return {
    source: "localStorage",
    trust: "unverified",
    writable: true,
    enumerable: true,
    notice:
      "Names are stored in this browser only. Nothing is shared, and nothing is verified.",

    lookup(id) {
      const record = stored[id];
      return record ? toEntry(id, record) : undefined;
    },

    list() {
      return Object.entries(stored).map(([id, record]) => toEntry(id, record));
    },

    publish(entry) {
      const existing = stored[entry.id] ?? {};
      const record: StoredEntry = { ...existing };
      if (entry.name !== undefined) record.name = entry.name;
      if (entry.peerId !== undefined) record.peerId = entry.peerId;
      if (entry.avatar !== undefined) {
        record.avatarBase64 = entry.avatar
          ? bytesToBase64(entry.avatar)
          : undefined;
      }
      stored = { ...stored, [entry.id]: record };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
      notify();
    },

    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
