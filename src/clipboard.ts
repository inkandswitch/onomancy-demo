export async function copyToClipboard(text: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
  } catch (error) {
    console.error("[Demo] Could not copy to the clipboard:", error);
  }
}
