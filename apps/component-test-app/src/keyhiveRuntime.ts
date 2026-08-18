import * as ark from "@automerge/automerge-repo-keyhive";
import { createKeyhiveRuntime } from "keyhive-react";

// The only route by which keyhive-react reaches the keyhive packages.
export const keyhiveRuntime = createKeyhiveRuntime(ark);
