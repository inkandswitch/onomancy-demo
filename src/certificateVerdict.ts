// The certificate verdict vocabulary and the one decision made over it.
//
// Split out of certificate.ts so the pure decision is testable without the
// onomancy Wasm: certificate.ts value-imports `verifyCertificate`, whose node
// entry inits the Wasm module at import time, which made the unit gate for a
// three-row table depend on a 2.6 MB artifact being resolvable. The same
// pure-core split record.ts and walk.ts already use.

/**
 * What a document's certificates say about a hostname's claim on it.
 *
 * Split by remedy, the same discipline the DNS status vocabulary uses. The
 * distinction that matters most is between the last two: `absent` is the
 * document making no claim, while `rejected` is evidence that arrived and
 * failed. Rendering those the same way would present a possible attack as a
 * missing feature.
 */
export type CertificateVerdict =
  | {
      status: "accepted";
      /** `on-path` proves the TXT generation key vouched for the signer. */
      generation: "on-path" | "provisional" | null;
      freshness: string;
      /** Decimal: the serial space is u64, which `number` cannot hold. */
      serial: string;
    }
  /** The document carries no certificate for this hostname. Not a failure. */
  | { status: "absent" }
  /** Evidence arrived and failed. A security signal. */
  | { status: "rejected"; reason: string };

/**
 * Whether a verdict is strong enough to call the binding mutual.
 *
 * **Strictness rises with freshness, which is the opposite of the intuition.**
 * A fresh chain is authoritative enough to convict, so a fresh chain whose
 * generation key is off-path is refused outright by the verifier and never
 * reaches here. A stale chain carrying the same condition grades
 * `provisional` instead, because stale evidence is unrefreshed rather than
 * authoritative — it is not proof of wrongdoing.
 *
 * Written as a table rather than a condition on purpose. `if (fresh) accept`
 * reads perfectly naturally and is backwards, and a conditional invites
 * exactly that shape.
 */
export function isMutual(verdict: CertificateVerdict): boolean {
  if (verdict.status !== "accepted") return false;
  switch (verdict.generation) {
    // The generation key vouched for the signer: the strongest statement the
    // format makes.
    case "on-path":
      return true;
    // Off-path under a stale chain. The verifier declined to convict on
    // unrefreshed evidence, and so do we: not proven, not disproven.
    case "provisional":
      return false;
    // No generation claim to check. Absent is not a failed check, but it is
    // also not a passed one.
    default:
      return false;
  }
}
