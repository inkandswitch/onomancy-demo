# keyhive-react (WIP)

React components for applications that use keyhive.

| Component | For |
| --- | --- |
| `AccountView` | Display name, avatar, and the local contact card |
| `PermissionsEditor` | Adding and removing members on a document |
| `DirectoryProvider` | Putting a name directory in scope |

Plus `useKeyhiveUpdates`, `useReRenderOnDocProgress`, `useSelfIdentity` and
`useAvatarUrl`.

## Using it

```tsx
import * as ark from "@automerge/automerge-repo-keyhive";
import {
  createKeyhiveRuntime,
  DirectoryProvider,
  PermissionsEditor,
  useKeyhiveUpdates,
} from "keyhive-react";
import "keyhive-react/styles.css";

const runtime = createKeyhiveRuntime(ark);

function Share({ hive, docUrl, directory }) {
  const keyhiveVersion = useKeyhiveUpdates(hive);
  return (
    <DirectoryProvider directory={directory}>
      <PermissionsEditor
        runtime={runtime}
        hive={hive}
        docUrl={docUrl}
        refreshToken={keyhiveVersion}
      />
    </DirectoryProvider>
  );
}
```

Membership queries are async and keyhive has no per-document change
notification, so components re-read when `refreshToken` changes. Subscribe once
near the top of an app rather than per component.

## The keyhive runtime

`createKeyhiveRuntime(ark)` supplies the keyhive constructors from the
application's own copy of ARK. The package imports none of them itself so
there is no second module instance of a WASM-backed package to resolve wrongly.

`pnpm build` runs `scripts/check-isolation.mjs` which fails if the compiled
output imports anything but React.

## The name directory

Components look peers up in the directory in scope and know nothing about where
the answer comes from, so a name registry is swapped by passing a different
object to `DirectoryProvider`.

A directory declares what it cannot do rather than stubbing it: `writable`,
`enumerable`, and `trust`, with an optional `notice` the components display.
`subscribe` is optional, for directories whose contents live outside React.

`createAutomergeDocDirectory` covers a shared Automerge map document that each
peer writes its own entry into.

## Styling

```ts
import "keyhive-react/styles.css";
```

Every class is prefixed `kh-` and every custom property `--kh-`, so the
stylesheet works in an application without Tailwind and alongside one with it.
There is no preflight. Override the tokens to restyle, and add the `dark` class
to a wrapper for the dark palette.

`scripts/check-prefix.mjs`, also part of `pnpm build`, fails if any unprefixed
Tailwind class is reachable from the source.

No images ship with the package. `Avatar` falls back to an initial, or `?` when
all it has is a hex id.

## Building

```
pnpm --filter keyhive-react build
```

Consuming apps build the library first, so `dist` is never stale. It is not
committed.

## Notes on the keyhive API

Import keyhive types from `@automerge/automerge-repo-keyhive`, which re-exports
them, rather than from `@keyhive/keyhive`. Two import paths can resolve to two
module instances.
