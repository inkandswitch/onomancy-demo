// The ONO0 record rules, replayed from the shared conformance vectors
// (tests/ono0-conformance-vectors.jsonl, vendored from the cross-repo
// bridge with its revision marker intact).
//
// This suite replaced src/record.ts's own tests when the parser,
// selection, and publisher rules moved down into onomancy
// (`classifyRecords`, `nextSerial`, `encodeRecord`): the rules under
// test are the package's, and the vectors are the contract all three
// repos answer to. What stays here is the replay — proof that the
// build this app resolves still gives the vectors' answers.

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  buildInfo,
  classifyRecords,
  encodeRecord,
  nextSerial,
  type RecordClassification,
} from "@inkandswitch/onomancy";

interface ParseVector {
  kind: "parse";
  name: string;
  input: string;
  expected: "parsed" | "malformed" | "unknownVersion" | "foreign";
  serial?: string;
}

interface ClassifyVector {
  kind: "classify";
  name: string;
  input: string[];
  nowMs?: string;
  expected:
    | { status: "bound"; serial: string; document: string; deferred?: number }
    | { status: "contested"; serial: string; documents: number }
    | { status: "unbound"; deferred: number };
}

interface NextSerialVector {
  kind: "nextSerial";
  name: string;
  last: string | null;
  now: string;
  expected: string;
}

type Vector = ParseVector | ClassifyVector | NextSerialVector;

const lines = readFileSync(
  new URL("./ono0-conformance-vectors.jsonl", import.meta.url),
  "utf8"
)
  .trim()
  .split("\n")
  .map((line: string) => JSON.parse(line) as { kind: string });

const vectors = lines.slice(1) as Vector[];

const SKEW_MS = 300_000n;

// A fixed, realistic instant, so the replay is deterministic where the
// vectors leave the clock open ("must hold at any realistic present-day
// clock"). Vector serials are either tiny or explicitly clocked.
const FIXED_NOW_SECONDS = 1_787_266_968;

// classifyRecords refuses implausible clocks (seconds-vs-milliseconds
// validation), so a vector needing a clock past this bound is exercised
// against the internal Rust rule only — sanctioned by the vectors' meta.
const IMPLAUSIBLE_SECONDS = 100_000_000_000n;

/**
 * A clock at which `serial` (milliseconds) escapes deferral, or
 * `undefined` when no plausible clock admits it.
 */
function clockFor(serial: string): number | undefined {
  const value = BigInt(serial);
  const floorMs = value > SKEW_MS ? value - SKEW_MS : 0n;
  const seconds = (floorMs + 999n) / 1000n;
  if (seconds >= IMPLAUSIBLE_SECONDS) return undefined;
  return seconds < BigInt(FIXED_NOW_SECONDS)
    ? FIXED_NOW_SECONDS
    : Number(seconds);
}

// doc1/doc2 name the p= values fill(32,1)/fill(32,3) (vectors meta).
// Their `automerge:` anchors are derived from the module itself via a
// singleton classification — a label mapping, not a correctness claim.
const FILL1_P = "AQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQE=";
const FILL3_P = "AwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwM=";
const FILL9_G = "CQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQk=";

function anchorOf(p: string): string {
  const outcome = classifyRecords(
    [`v=ONO0;k=ed25519;n=7;g=${FILL9_G};p=${p}`],
    FIXED_NOW_SECONDS
  );
  if (!outcome.selected) throw new Error(`anchor derivation failed for ${p}`);
  return outcome.selected.document;
}

const DOC_ANCHOR: Record<string, string> = {
  doc1: anchorOf(FILL1_P),
  doc2: anchorOf(FILL3_P),
};

function rejectTallies(outcome: RecordClassification) {
  return {
    malformed: outcome.malformed,
    foreign: outcome.foreign,
    unknownVersion: outcome.unknownVersion,
  };
}

it("replays against a known build", () => {
  const info = buildInfo();
  expect(info.version).toBeTruthy();
});

describe("parse vectors", () => {
  const parses = vectors.filter((v): v is ParseVector => v.kind === "parse");

  for (const vector of parses) {
    it(vector.name, () => {
      if (vector.expected === "parsed") {
        const now =
          vector.serial === undefined
            ? FIXED_NOW_SECONDS
            : clockFor(vector.serial);
        if (now === undefined) {
          // No plausible clock admits the serial (the u64 ceiling), but
          // only a grammatical binding can land in `deferred`, so the
          // parse is still provable.
          const outcome = classifyRecords([vector.input], FIXED_NOW_SECONDS);
          expect(rejectTallies(outcome)).toEqual({
            malformed: 0,
            foreign: 0,
            unknownVersion: 0,
          });
          expect(outcome.deferred).toBe(1);
          return;
        }
        const outcome = classifyRecords([vector.input], now);
        expect(rejectTallies(outcome)).toEqual({
          malformed: 0,
          foreign: 0,
          unknownVersion: 0,
        });
        expect(outcome.selected?.serial).toBe(vector.serial);
      } else {
        const outcome = classifyRecords([vector.input], FIXED_NOW_SECONDS);
        expect(outcome[vector.expected]).toBe(1);
        expect(outcome.selected).toBeUndefined();
        expect(outcome.contested).toBeUndefined();
      }
    });
  }
});

describe("classify vectors", () => {
  const classifies = vectors.filter(
    (v): v is ClassifyVector => v.kind === "classify"
  );

  for (const vector of classifies) {
    const clock = (() => {
      if (vector.nowMs === undefined) return FIXED_NOW_SECONDS;
      const ms = BigInt(vector.nowMs);
      if (ms % 1000n !== 0n || ms / 1000n >= IMPLAUSIBLE_SECONDS) {
        return undefined;
      }
      return Number(ms / 1000n);
    })();

    if (clock === undefined) {
      // The u64-adjacent clock cannot cross the nowSeconds surface;
      // the vectors' meta assigns it to the internal Rust rule.
      it.skip(vector.name, () => {});
      continue;
    }

    it(vector.name, () => {
      const outcome = classifyRecords(vector.input, clock);
      const expected = vector.expected;

      if (expected.status === "bound") {
        expect(outcome.contested).toBeUndefined();
        expect(outcome.selected?.serial).toBe(expected.serial);
        expect(outcome.selected?.document).toBe(DOC_ANCHOR[expected.document]);
        if (expected.deferred !== undefined) {
          expect(outcome.deferred).toBe(expected.deferred);
        }
      } else if (expected.status === "contested") {
        expect(outcome.selected).toBeUndefined();
        const contested = outcome.contested ?? [];
        expect(contested.length).toBeGreaterThanOrEqual(2);
        for (const claim of contested) {
          expect(claim.serial).toBe(expected.serial);
        }
        const documents = new Set(contested.map((claim) => claim.document));
        expect(documents.size).toBe(expected.documents);
      } else {
        expect(outcome.selected).toBeUndefined();
        expect(outcome.contested).toBeUndefined();
        expect(outcome.deferred).toBe(expected.deferred);
      }
    });
  }
});

describe("nextSerial vectors", () => {
  const serials = vectors.filter(
    (v): v is NextSerialVector => v.kind === "nextSerial"
  );

  for (const vector of serials) {
    it(vector.name, () => {
      const last = vector.last === null ? undefined : vector.last;
      // Exact for every vector value, including 2^64 (an exact double).
      const now = Number(vector.now);

      if (vector.expected === "refuse") {
        expect(() => nextSerial(last, now)).toThrow();
      } else {
        expect(nextSerial(last, now)).toBe(vector.expected);
      }
    });
  }
});

describe("encodeRecord", () => {
  it("writes the byte-identical spelling the parse vectors pin", () => {
    const canonical = vectors.find(
      (v): v is ParseVector =>
        v.kind === "parse" && v.name === "valid record round-trips"
    );
    if (!canonical) throw new Error("the round-trip vector is missing");

    expect(encodeRecord("7", FILL9_G, DOC_ANCHOR.doc1)).toBe(canonical.input);
  });

  it("refuses what the parser refuses", () => {
    // Leading-zero serial, non-canonical base64, and a non-anchor document
    // are the writer-side halves of parse vectors above.
    expect(() => encodeRecord("07", FILL9_G, DOC_ANCHOR.doc1)).toThrow();
    expect(() =>
      encodeRecord("7", FILL9_G.replace(/=+$/, ""), DOC_ANCHOR.doc1)
    ).toThrow();
    expect(() => encodeRecord("7", FILL9_G, "automerge:nonsense")).toThrow();
  });
});
