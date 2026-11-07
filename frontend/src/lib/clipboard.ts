/**
 * Clipboard access that also works over plain-HTTP LAN origins, where
 * `navigator.clipboard` is unavailable in Safari and Firefox.
 */
export async function copyToClipboard(value: string): Promise<boolean> {
  if (typeof navigator !== "undefined" && navigator.clipboard && window.isSecureContext) {
    try {
      await navigator.clipboard.writeText(value);
      return true;
    } catch {
      // Fall through to the selection-based fallback.
    }
  }

  if (typeof document === "undefined") return false;
  const area = document.createElement("textarea");
  area.value = value;
  area.setAttribute("readonly", "");
  area.setAttribute("aria-hidden", "true");
  area.style.position = "fixed";
  area.style.top = "0";
  area.style.left = "0";
  area.style.opacity = "0";
  area.style.fontSize = "16px";
  document.body.appendChild(area);

  let copied = false;
  try {
    area.focus();
    area.select();
    area.setSelectionRange(0, value.length);
    copied = document.execCommand("copy");
  } catch {
    copied = false;
  } finally {
    document.body.removeChild(area);
  }
  return copied;
}
