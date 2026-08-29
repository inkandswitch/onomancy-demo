// The onomancy runtime handed to @automerge/keyhive-react.
//
// The library imports nothing from onomancy at runtime, exactly as it imports
// nothing from ARK, so this is the only route by which the Wasm reaches it and
// the app's single instance stays single. Mirrors keyhiveRuntime.ts.

import * as onomancy from "@inkandswitch/onomancy";
import { createOnomancyRuntime } from "@automerge/keyhive-react";

export const onomancyRuntime = createOnomancyRuntime(onomancy);
