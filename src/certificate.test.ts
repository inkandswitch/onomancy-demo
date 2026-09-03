// `isMutual` is the one place the demo decides a checkmark, and the rule is
// documented as "the opposite of the intuition": strictness rises with
// freshness, so `if (fresh) accept` is the negation of it. A table test pins
// each row so the conditional shape can never sneak back in.

import { describe, expect, it } from "vitest";
// Imported from the pure module, not certificate.ts, so this unit gate does
// not load the onomancy Wasm at collect time.
import { isMutual } from "./certificateVerdict";
import type { CertificateVerdict } from "./certificateVerdict";

const accepted = (
  generation: "on-path" | "provisional" | null
): CertificateVerdict => ({
  status: "accepted",
  generation,
  freshness: "fresh",
  serial: "1",
});

describe("isMutual", () => {
  it("accepts only an on-path generation", () => {
    expect(isMutual(accepted("on-path"))).toBe(true);
  });

  it("refuses provisional: stale evidence is unrefreshed, not authoritative", () => {
    expect(isMutual(accepted("provisional"))).toBe(false);
  });

  it("refuses an absent generation claim: unchecked is not passed", () => {
    expect(isMutual(accepted(null))).toBe(false);
  });

  it("never grants on a non-accepted verdict", () => {
    expect(isMutual({ status: "absent" })).toBe(false);
    expect(isMutual({ status: "rejected", reason: "chain-rejected" })).toBe(
      false
    );
    expect(isMutual({ status: "unsynced" })).toBe(false);
  });
});
