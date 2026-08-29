# Keyhive TODO Demo

A small React app that shows how to build a collaborative, access-controlled app
with [automerge-repo](https://github.com/automerge/automerge-repo) and
[keyhive](https://github.com/inkandswitch/keyhive), wired together by
[automerge-repo-keyhive](https://github.com/inkandswitch/automerge-repo-keyhive)
(ARK).

Each TODO list is an end-to-end encrypted Automerge document. The demo
demonstrates:

- Creating and editing documents that sync through a subduction sync server.
- Sharing a document with another identity at a chosen access level (relay,
  read, edit, admin) via its contact card.
- Sharing a document by invite link, which anyone can open to add themselves.
- Making a document public so anyone can read or edit it.
- Revoking access, and access-gated UI (read-only view, hidden share button)
  driven by keyhive membership.
- Naming documents with [onomancy](https://github.com/inkandswitch/onomancy),
  so a list can be opened as `~/todos/groceries` or `@example.com/todos`
  instead of by document id.

## Run

The demo needs a phonebook document id, which it requires you to supply. Generate
one into a `.env` file, then start the app:

```
pnpm install
echo "PHONEBOOK_DOC_ID=$(pnpm -s gen:phonebook-id)" > .env
pnpm dev
```

The app opens at http://localhost:5557.

Do this once. Keep the same id from then on. A fresh one points the app at a
brand new, empty phonebook, so every name and avatar disappears. `.env` is
gitignored.

To override the id for a single run without touching `.env`:

```
PHONEBOOK_DOC_ID=automerge:... pnpm dev
```

### With Nix

`nix develop` drops you into a shell with node, pnpm and the language servers,
and prints a menu of the commands below.

| Command             | Purpose                                                                    |
| ------------------- | -------------------------------------------------------------------------- |
| `dev`               | Seed `.env` if it has no id yet, then start the dev server.                |
| `dev:local`         | The same, against a local sync server instead of the public one.           |
| `env:init`          | Write a fresh `PHONEBOOK_DOC_ID` to `.env`, leaving an existing one alone. |
| `lint` / `lint:fix` | ESLint and Prettier.                                                       |
| `sync-server`       | Run a local `subduction_cli` on `:3030`. Built on first use.               |
| `ci`                | Lint, typecheck and build, the way CI runs them.                           |

Each is also a flake app, so `nix run .#ci` and `nix run .#sync-server` work
without entering the shell. `sync-server` builds the subduction Rust workspace
the first time you run it, which is why it is not part of the dev shell.

## Phonebook configuration

The phonebook is a shared document holding every peer's display name and avatar.
It is an ordinary Automerge document: unencrypted, and writable by anyone who
knows its id. So rather than shipping one hardcoded id that every copy of the
demo writes to, the demo requires you to supply your own via the
`PHONEBOOK_DOC_ID` build variable. Generate an id with `pnpm gen:phonebook-id`
and share it with the people you want in your phonebook.

The document does not need to exist beforehand. The first peer to run with a
given id creates it and later peers pick it up from the sync server.

Keep in mind that the id is the only thing protecting the phonebook. Anyone you
give it to, and anyone they give it to, can edit its entries. This is fine for a
demo but is not an access-control mechanism. The TODO documents themselves are
end-to-end encrypted and access-controlled by keyhive.

## Sync server configuration

By default the demo connects to the public keyhive sync server at
`wss://keyhive.sync.automerge.org` using ARK's built-in `keyhive` identity.

Three build-time variables override this:

| Variable                   | Purpose                                          |
| -------------------------- | ------------------------------------------------ |
| `SYNC_SERVER`              | Websocket endpoint (e.g. `ws://localhost:3030`). |
| `SYNC_SERVER_CONTACT_CARD` | The server's signed contact card JSON.           |
| `SYNC_SERVER_PEER_ID`      | The server's keyhive peer id.                    |

`SYNC_SERVER_CONTACT_CARD` and `SYNC_SERVER_PEER_ID` must be set together, and
the identity they describe must match the server `SYNC_SERVER` points at. When
they are unset the demo uses the built-in `keyhive` identity.

## Invite links

"Create invite link" in the share modal produces a URL that anyone can open to
give themselves access to that list, at the access level selected next to it.

In Keyhive, every membership change has to be signed by a principal that already
holds at least the access being granted. An invite link carries one. Creating it
generates a throwaway keyhive identity, delegates the document to that identity,
and puts its key pair and prekey secrets in the URL fragment. Opening the link
rebuilds that identity in the visitor's browser, briefly runs it as a second hive
against the same sync server, and uses it to delegate the document to the visitor's
own identity.

The link is a bearer capability. Anyone who sees the URL has the access it
carries, so treat it the way you would treat the document's contents.

Once the join finishes, the fragment is replaced so the key material doesn't stay
in the tab's history.

The throwaway identity appears in the member list like any other member.
Removing it there turns the link off. Keyhive re-roots the people who joined
through it under whoever revokes it, so turning off a link does not remove the
people who already used it.

## Names

A list can be given a name instead of being passed around as a document id.
Right-click a list in the sidebar and choose "Name this list...", then open it
again from "Open by name". A name is also a URL, so `#~/todos/groceries` in the
address bar resolves and opens the same list.

Names come from [onomancy](https://github.com/inkandswitch/onomancy). A name
has an anchor and a path, and the anchor is the whole of what makes the answer
trustworthy:

| Name                  | Starts from                         | Worth                                       |
| --------------------- | ----------------------------------- | ------------------------------------------- |
| `~/todos/groceries`   | your own namestore                  | as much as the document you hold            |
| `@example.com/todos`  | the document that domain designates | a DNSSEC chain from the IANA root           |
| `automerge:.../todos` | that document                       | the id is the key, so it is self-certifying |

After the anchor picks a starting document, all three walk identically: each
path segment follows one edge to the next document, taking the longest matching
key at each step and never backtracking. A bare `todos/groceries` is read as a
`~` name, and the canonical spelling is what the app reports back.

### Namestores

A namestore is where names are written. It is an ordinary keyhive document, so
who may bind a name in it is an access-control question with a real answer, and
it is created through ARK, so its id is an ed25519 verifying key. Onomancy
requires that: a legacy Automerge document id is rejected as "not
self-certifying", which is why names do not live in the phonebook.

Yours is created on first run. Its id, and the DNS record described below, are
in the account modal behind the avatar in the top right.

Binding `@example.com/todos` writes into the namestore _that domain_
designates, not yours, so it needs admin access there. The anchor decides which
document is written; the write itself is the same in every case.

### Partial resolution

A name can stop part way, and the demo says so rather than calling it an error:

- The next document has not synced to this device. Nothing is proven about the
  name; a replica may arrive and the same walk finish.
- The document is held and simply has no edge for what remains. That is an
  answer: nothing is bound there.

Resolution reads locally held replicas and never blocks on sync, so stopping
short is the designed behaviour under partition rather than a failure.

### Claiming a domain

Publish the DNS record from the account modal as a TXT record at
`_onomancy.<your-domain>`. Once DNSSEC signs it, `@your-domain/...` resolves
for everyone, verified locally from the IANA root key baked into the onomancy
Wasm — no certificate authority and no trusted resolver.

The record names the _namestore document_, not you. Ownership of the name is
whoever that document grants admin to, so a name is shared by inviting another
admin rather than by editing DNS again, and a key rotation does not touch DNS
either.

DNS proves `hostname -> document`. Keyhive proves `document -> people`. Neither
layer is asked to do the other's job.

## Build

```
pnpm build
```

The static site is written to `dist/`.

## Learn more

For the ARK API this demo is built on, see the automerge-repo-keyhive API guide
at `docs/automerge-repo-keyhive-api-guide.md` in the
[automerge-repo-keyhive](https://github.com/inkandswitch/automerge-repo-keyhive)
repository.
