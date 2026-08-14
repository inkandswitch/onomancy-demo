import { log } from "./log";

export async function copyToClipboard(text: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
  } catch (error) {
    log.error("Could not copy to the clipboard:", error);
  }
}
