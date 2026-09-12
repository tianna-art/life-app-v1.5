/**
 * はじめに.
 *
 * The card shows itself and opens the editor itself. The prototype kept that
 * handler inside one screen's renderer, which is why the identical card on the
 * other screen had a 「はじめる」 that did nothing — so what is tested here is
 * that no screen has to remember anything.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, fireEvent } from '@testing-library/react-native';
import { VisionIntro } from '@components/vision/VisionIntro';
import * as data from '@/data';

const mockPush = jest.fn();
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush }) }));

function show(vision: { items: unknown[]; words: unknown[] }) {
  jest.spyOn(data, 'getRepository').mockReturnValue({
    listVisionItems: async () => vision.items,
    listVisionWords: async () => vision.words,
  } as unknown as ReturnType<typeof data.getRepository>);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <VisionIntro />
    </QueryClientProvider>
  );
}

describe('the invitation', () => {
  beforeEach(() => mockPush.mockClear());
  afterEach(() => jest.restoreAllMocks());

  it('appears while the board is empty', async () => {
    show({ items: [], words: [] });
    await waitFor(() => expect(screen.getByTestId('vision-intro')).toBeTruthy());
    expect(screen.getByText('まずはビジョンボードを設定しよう。')).toBeTruthy();
  });

  it('opens the editor on its own, wherever it is rendered', async () => {
    show({ items: [], words: [] });
    await waitFor(() => expect(screen.getByTestId('vision-start')).toBeTruthy());
    fireEvent.press(screen.getByTestId('vision-start'));
    expect(mockPush).toHaveBeenCalledWith('/vision/setup');
  });

  it('offers no way to decline — the screen below works without a board', async () => {
    show({ items: [], words: [] });
    await waitFor(() => expect(screen.getByTestId('vision-intro')).toBeTruthy());
    expect(screen.queryByText('あとで')).toBeNull();
  });

  it('is gone for good once the board holds anything', async () => {
    show({ items: [{ id: 'v1' }], words: [] });
    await waitFor(() =>
      expect(screen.queryByTestId('vision-intro')).toBeNull()
    );
  });

  it('shows nothing at all until the answer is in', () => {
    // Better a moment late than an invitation flashed at somebody who already
    // has a board.
    show({ items: [], words: [] });
    expect(screen.queryByTestId('vision-intro')).toBeNull();
  });
});
