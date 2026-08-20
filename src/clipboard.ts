import { log } from "./log";

/**
 * Copy `text`, reporting whether it worked.
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (error) {
    log.error("Could not copy to the clipboard:", error);
    return false;
  }
}
