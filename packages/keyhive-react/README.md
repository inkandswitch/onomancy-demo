# keyhive-react (WIP)

React components for applications that use keyhive.

| Component | For |
| --- | --- |
| `AccountView` | Display name, avatar, and the local contact card |
| `PermissionsEditor` | Adding and removing members on a document |

Plus `useKeyhiveUpdates`, `useReRenderOnDocProgress`, `useSelfIdentity` and
`useAvatarUrl`.

## Using it

```tsx
const keyhiveVersion = useKeyhiveUpdates(hive);

<PermissionsEditor
  hive={hive}
  docUrl={docUrl}
  contacts={contacts}
  refreshToken={keyhiveVersion}
/>;
```

Membership queries are async and keyhive has no per-document change
notification, so components re-read when `refreshToken` changes. Subscribe once
near the top of an app rather than per component.

`contacts` is supplied by the application and maps a hex keyhive id to a display name and avatar.

## Styling

Components render Tailwind utilities against the semantic token names
shadcn/ui uses (`background`, `card`, `muted`, `border`, and their
`-foreground` pairs). An app needs those tokens, and needs this package in its
Tailwind `content` globs or the classes are purged.

`Modal` plays the optional `fadeIn` and `slideIn` keyframes.

No images ship with the package. `Avatar` falls back to an initial, or `?` when
all it has is a hex id. Pass `fallbackSrc` for an app's own placeholder.

## Building

```
pnpm --filter keyhive-react build
```

Both `dev` and `build` in the consuming app run this first, so `dist` is never
stale. It is not committed.

## Notes on the keyhive API

Import keyhive types from `@automerge/automerge-repo-keyhive`, which re-exports
them, rather than from `@keyhive/keyhive`. Two import paths can resolve to two
module instances.
