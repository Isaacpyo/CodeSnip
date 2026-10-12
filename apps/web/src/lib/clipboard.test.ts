import { afterEach, describe, expect, it, vi } from 'vitest';
import { copyText } from './clipboard';

const originalClipboard = Object.getOwnPropertyDescriptor(navigator, 'clipboard');

function setClipboard(value: Partial<Clipboard> | undefined) {
  Object.defineProperty(navigator, 'clipboard', { value, configurable: true });
}

afterEach(() => {
  if (originalClipboard) Object.defineProperty(navigator, 'clipboard', originalClipboard);
  else setClipboard(undefined);
  vi.unstubAllGlobals();
});

describe('copyText', () => {
  it('uses the async clipboard API for strings', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    setClipboard({ writeText });
    await copyText('hello');
    expect(writeText).toHaveBeenCalledWith('hello');
  });

  it('starts a ClipboardItem write synchronously for pending text (Safari)', async () => {
    const write = vi.fn().mockResolvedValue(undefined);
    setClipboard({ write, writeText: vi.fn() });
    class FakeClipboardItem {
      constructor(public items: Record<string, Promise<Blob>>) {}
    }
    vi.stubGlobal('ClipboardItem', FakeClipboardItem);
    await copyText(Promise.resolve('later'));
    expect(write).toHaveBeenCalledTimes(1);
    const [item] = write.mock.calls[0]![0] as FakeClipboardItem[];
    const blob = await item!.items['text/plain']!;
    expect(await blob.text()).toBe('later');
  });

  it('falls back to execCommand when the clipboard API is unavailable or denied', async () => {
    setClipboard({ writeText: vi.fn().mockRejectedValue(new Error('denied')) });
    const exec = vi.fn().mockReturnValue(true);
    document.execCommand = exec;
    await copyText('fallback');
    expect(exec).toHaveBeenCalledWith('copy');
    expect(document.querySelector('textarea')).toBeNull();
  });

  it('throws when every method fails', async () => {
    setClipboard(undefined);
    document.execCommand = vi.fn().mockReturnValue(false);
    await expect(copyText('nope')).rejects.toThrow(/rejected/);
  });
});
