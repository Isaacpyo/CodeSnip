/**
 * Copies text to the clipboard. Accepts a promise so callers can start the
 * copy inside the click handler while the text is still loading: Safari only
 * allows clipboard writes that begin synchronously in a user gesture, which
 * ClipboardItem-with-a-promise satisfies.
 */
export async function copyText(text: string | Promise<string>): Promise<void> {
  const clipboard = typeof navigator !== 'undefined' ? navigator.clipboard : undefined;

  if (typeof text !== 'string' && clipboard?.write && typeof ClipboardItem !== 'undefined') {
    const blob = text.then((value) => new Blob([value], { type: 'text/plain' }));
    await clipboard.write([new ClipboardItem({ 'text/plain': blob })]);
    return;
  }

  const value = await text;
  if (clipboard?.writeText) {
    try {
      await clipboard.writeText(value);
      return;
    } catch {
      // Permission denied or insecure context: fall through to the legacy path.
    }
  }
  legacyCopy(value);
}

function legacyCopy(value: string): void {
  const textarea = document.createElement('textarea');
  textarea.value = value;
  textarea.setAttribute('readonly', '');
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);
  textarea.select();
  try {
    if (!document.execCommand('copy')) throw new Error('Copy command was rejected');
  } finally {
    textarea.remove();
  }
}
