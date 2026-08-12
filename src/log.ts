/**
 * Leveled logger. Defaults to "warn".
 *
 * Raise it from the browser console while diagnosing something:
 *
 * ```ts
 * // The demo's own messages
 * window.setDemoLogLevel("debug");
 * // ARK's, via its exported control
 * import { setKeyhiveLogLevel } from "@automerge/automerge-repo-keyhive";
 * setKeyhiveLogLevel("debug");
 * ```
 */
export type DemoLogLevel = "silent" | "error" | "warn" | "info" | "debug";

const LEVEL_ORDER: Record<DemoLogLevel, number> = {
  silent: 0,
  error: 1,
  warn: 2,
  info: 3,
  debug: 4,
};

let currentLevel: DemoLogLevel = "warn";

export function setDemoLogLevel(level: DemoLogLevel): void {
  currentLevel = level;
}

export function getDemoLogLevel(): DemoLogLevel {
  return currentLevel;
}

function enabled(level: DemoLogLevel): boolean {
  return LEVEL_ORDER[currentLevel] >= LEVEL_ORDER[level];
}

export const log = {
  error(...args: unknown[]): void {
    if (enabled("error")) console.error("[Demo]", ...args);
  },
  warn(...args: unknown[]): void {
    if (enabled("warn")) console.warn("[Demo]", ...args);
  },
  info(...args: unknown[]): void {
    if (enabled("info")) console.log("[Demo]", ...args);
  },
  debug(...args: unknown[]): void {
    if (enabled("debug")) console.debug("[Demo]", ...args);
  },
};

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
