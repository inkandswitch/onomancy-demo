import * as ark from "@automerge/automerge-repo-keyhive";
import { createKeyhiveRuntime } from "keyhive-react";

// keyhive-react imports nothing from the automerge or keyhive packages at
// runtime, so this is the only route by which it reaches them.
export const keyhiveRuntime = createKeyhiveRuntime(ark);
