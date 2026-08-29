import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { DOCUMENT_ID_BYTES, bindingRecord, parseBindingRecord } from "./record";

const documentId = fc
  .uint8Array({ minLength: DOCUMENT_ID_BYTES, maxLength: DOCUMENT_ID_BYTES })
  .map((bytes) => new Uint8Array(bytes));

// Any length: the generation key is not the thing the format constrains.
const generationKey = fc
  .uint8Array({ minLength: 1, maxLength: 64 })
  .map((bytes) => new Uint8Array(bytes));

const generation = fc.integer({ min: 0, max: Number.MAX_SAFE_INTEGER });

const hex = (bytes: Uint8Array): string =>
  [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");

describe("the v=ONO0 binding record", () => {
  it("round-trips every field it carries", () => {
    fc.assert(
      fc.property(generationKey, documentId, generation, (key, doc, n) => {
        const parsed = parseBindingRecord(bindingRecord(key, doc, n));
        expect(parsed).toBeDefined();
        expect(parsed?.generation).toBe(n);
        expect([...(parsed?.generationKey ?? [])]).toEqual([...key]);
        expect([...(parsed?.documentId ?? [])]).toEqual([...doc]);
      })
    );
  });

  it("rejects a document id that is not a verifying key's length", () => {
    fc.assert(
      fc.property(
        generationKey,
        fc
          .uint8Array({ minLength: 0, maxLength: 64 })
          .filter((bytes) => bytes.length !== DOCUMENT_ID_BYTES),
        generation,
        (key, doc, n) => {
          const record = bindingRecord(key, new Uint8Array(doc), n);
          expect(parseBindingRecord(record)).toBeUndefined();
        }
      )
    );
  });

  it("rejects anything that is not a well-formed record", () => {
    // Unparseable is absent, never a throw: one malformed record among a
    // domain's several must not deny the others.
    fc.assert(
      fc.property(fc.string(), (junk) => {
        expect(() => parseBindingRecord(junk)).not.toThrow();
      })
    );

    for (const record of [
      "",
      "v=ONO1;k=ed25519;n=1;g=AA==;p=AA==",
      "v=ONO0;k=x25519;n=1;g=AA==;p=AA==",
      // Fields out of order.
      "v=ONO0;k=ed25519;n=1;p=AA==;g=AA==",
      // An unknown field appended.
      `${bindingRecord(new Uint8Array(32), new Uint8Array(32), 1)};x=1`,
      // A non-numeric generation.
      "v=ONO0;k=ed25519;n=abc;g=AA==;p=AA==",
    ]) {
      expect(parseBindingRecord(record)).toBeUndefined();
    }
  });

  it("reads the record brooklynzelenka.com actually publishes", () => {
    // Captured from a live DoH + DNSSEC resolution, so the format this app
    // writes is pinned against the one production already serves.
    const parsed = parseBindingRecord(
      "v=ONO0;k=ed25519;n=1787792719795;g=8XXKlRi7D9msSp8U4TZo0AzQ99InBDquIYprrW7NoI4=;p=nJ8I/xDYHbttOOpAzRaYFgGpvdtYmlGuXNsaNKWz+Us="
    );
    expect(parsed).toBeDefined();
    expect(parsed?.generation).toBe(1787792719795);
    expect(hex(parsed?.documentId ?? new Uint8Array())).toBe(
      "9c9f08ff10d81dbb6d38ea40cd16981601a9bddb589a51ae5cdb1a34a5b3f94b"
    );
  });
});
