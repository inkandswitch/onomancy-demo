// The reserved-prefix guard is the only thing standing between an ordinary
// "name this list" bind and silently replacing the certificate list — a
// user-triggerable write that degrades every verified `@host` badge to
// "makes no claim" while looking like a successful bind. The predicate is
// pure and fires before any document is touched, so it is testable without a
// repo, and the migration definition-of-done requires exactly that: each
// guard verified, not merely present.

import { describe, expect, it } from "vitest";
import { ReservedPathError, refuseReservedPath } from "./namestore";

describe("the .well-known/ reserved-path guard", () => {
  it("refuses the certificate list path itself", () => {
    expect(() =>
      refuseReservedPath(".well-known/onomancy/certificates")
    ).toThrow(ReservedPathError);
  });

  it("refuses the whole prefix, not just the known key", () => {
    // Onomancy's ownership of `.well-known/` is assigned, so any path under
    // it is theirs to define — including ones that do not exist yet.
    expect(() => refuseReservedPath(".well-known/onomancy")).toThrow(
      ReservedPathError
    );
    expect(() => refuseReservedPath(".well-known/anything/else")).toThrow(
      ReservedPathError
    );
  });

  it("refuses the bare prefix", () => {
    expect(() => refuseReservedPath(".well-known")).toThrow(ReservedPathError);
  });

  it("passes lookalikes that are not under the prefix", () => {
    // A prefix rule, not a substring rule: these are ordinary (if odd) names.
    expect(() => refuseReservedPath("well-knownish")).not.toThrow();
    expect(() => refuseReservedPath(".well-knownish/x")).not.toThrow();
    expect(() => refuseReservedPath("todos/.well-known")).not.toThrow();
  });
});
