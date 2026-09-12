/**
 * マイページ.
 *
 * The rules under test: all three items are on screen before any of them
 * works, the two that are empty cannot be opened onto nothing, and ログアウト
 * is never offered without saying which account it would leave.
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

  it('does not open the two that have nothing behind them', () => {
    renderScreen();
    fireEvent.press(screen.getByTestId('settings-notify'));
    fireEvent.press(screen.getByTestId('settings-export'));
    expect(screen.queryByTestId('settings-account-open')).toBeNull();
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
