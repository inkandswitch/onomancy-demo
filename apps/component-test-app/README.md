# Component test app

A second consumer of [`keyhive-react`](../../packages/keyhive-react), sharing
no code with the TODO demo and differing from it everywhere the demo could have
been relying on the components:

| | TODO demo | This app |
| --- | --- | --- |
| Name directory | shared Automerge phonebook | localStorage, per browser |
| Directory updates | new object each change | `subscribe` callbacks |
| Styling | its own Tailwind setup | `keyhive-react/styles.css` only |
| Theme | dark | light |
| Component context | dialogs | inline sections |

## Run

```
pnpm install
pnpm --filter component-test-app dev
```

It opens at http://localhost:5558 and builds the library first. There is no
configuration and no phonebook id to supply.

## Trying the access components

Granting access needs a second identity which you can test using a second browser
profile. Open the app there, copy its contact card from the account section, and
paste it into the "Contact Card" field here.
