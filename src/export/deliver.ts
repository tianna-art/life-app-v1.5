import { Platform } from 'react-native';

/**
 * Handing the file over.
 *
 * Two platforms, two meanings of "have the file". On the web it lands in the
 * downloads folder; on a phone it goes through the share sheet, where the
 * person picks what has it — Files, mail, a note. Neither path keeps a copy:
 * the file is written to the cache directory and the system clears it.
 *
 * Nothing is uploaded anywhere. 「書いたものを手元に持ち出します。」 means
 *手元, and a round trip through a server to make a download link would be a
 * different sentence.
 */
export async function deliver(filename: string, contents: string): Promise<void> {
  if (Platform.OS === 'web') {
    const blob = new Blob([contents], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    // Let the click start before the blob is released.
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return;
  }

  // Imported here rather than at the top so the web bundle never pulls in a
  // native file system it cannot use.
  const { File, Paths } = await import('expo-file-system');
  const { isAvailableAsync, shareAsync } = await import('expo-sharing');

  const file = new File(Paths.cache, filename);
  file.create({ overwrite: true });
  file.write(contents);

  if (!(await isAvailableAsync())) throw new Error('SHARING_UNAVAILABLE');
  await shareAsync(file.uri, { mimeType: 'text/markdown', UTI: 'net.daringfireball.markdown' });
}
