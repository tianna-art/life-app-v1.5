/**
 * マイページ.
 *
 * The rules under test: all three items are on screen whether or not they do
 * anything, an item with no working home does not open onto nothing, and
 * ログアウト is never offered without saying which account it would leave.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import SettingsScreen from '../app/(tabs)/settings';
import * as session from '@/lib/session';

jest.mock('@/lib/env', () => ({
  ...jest.requireActual('@/lib/env'),
  useLocalStore: false,
  hasSupabaseConfig: true,
}));

function renderScreen() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <SettingsScreen />
    </QueryClientProvider>
  );
}

describe('マイページ', () => {
  beforeEach(() => {
    jest
      .spyOn(session, 'currentAccount')
      .mockResolvedValue({ email: 'someone@example.com' });
  });

  afterEach(() => jest.restoreAllMocks());

  it('shows all three items, built or not', () => {
    renderScreen();
    expect(screen.getByTestId('settings-notify')).toBeTruthy();
    expect(screen.getByTestId('settings-export')).toBeTruthy();
    expect(screen.getByTestId('settings-account')).toBeTruthy();
  });

  it('opens the ones that work', () => {
    renderScreen();
    fireEvent.press(screen.getByTestId('settings-export'));
    expect(screen.getByTestId('settings-export-open')).toBeTruthy();
    expect(screen.getByTestId('export-run')).toBeTruthy();
  });

  it('offers 通知 as two moments and a time, and nothing daily', async () => {
    renderScreen();
    fireEvent.press(screen.getByTestId('settings-notify'));
    await waitFor(() => expect(screen.getByTestId('notify-toggle')).toBeTruthy());
    expect(screen.getByTestId('notify-hour-21')).toBeTruthy();
    expect(
      screen.getByText('知らせるのは月初と月末だけです。書けていない日のことは言いません。')
    ).toBeTruthy();
  });

  it('shows one panel at a time', async () => {
    renderScreen();
    fireEvent.press(screen.getByTestId('settings-export'));
    fireEvent.press(screen.getByTestId('settings-account'));
    await waitFor(() => expect(screen.getByTestId('settings-account-open')).toBeTruthy());
    expect(screen.queryByTestId('settings-export-open')).toBeNull();
  });

  it('names the account before offering to leave it', async () => {
    renderScreen();
    fireEvent.press(screen.getByTestId('settings-account'));
    await waitFor(() => expect(screen.getByText('someone@example.com')).toBeTruthy());
    expect(screen.getByTestId('settings-logout')).toBeTruthy();
  });

  it('signs out through the one shared path', async () => {
    const out = jest.spyOn(session, 'signOutEverywhere').mockResolvedValue(undefined);
    renderScreen();
    fireEvent.press(screen.getByTestId('settings-account'));
    await waitFor(() => expect(screen.getByTestId('settings-logout')).toBeTruthy());
    fireEvent.press(screen.getByTestId('settings-logout'));
    expect(out).toHaveBeenCalled();
  });
});
