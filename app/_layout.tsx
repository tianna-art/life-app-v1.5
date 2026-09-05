import { useMemo } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Stack } from 'expo-router';
import { QueryClientProvider } from '@tanstack/react-query';
import { createQueryClient } from '@/lib/queryClient';
import { colors } from '@/theme';
import { useAuth } from '@/hooks/useAuth';
import { useOutboxSync } from '@/hooks/useLogs';
import { AuthGate } from '@components/ui/AuthGate';
import { PhoneFrame } from '@components/ui/PhoneFrame';

export default function RootLayout() {
  const queryClient = useMemo(() => createQueryClient(), []);

  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <StatusBar style="light" />
          <PhoneFrame>
            <AppShell />
          </PhoneFrame>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

function AppShell() {
  const auth = useAuth();
  useOutboxSync();

  if (auth.loading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={colors.brass} />
      </View>
    );
  }

  if (!auth.ready) return <AuthGate auth={auth} />;

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.ink },
        animation: 'fade',
      }}
    >
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="log/[id]" options={{ presentation: 'card' }} />
      <Stack.Screen name="records/[ids]" options={{ presentation: 'card' }} />
      <Stack.Screen name="month/[key]" options={{ presentation: 'card' }} />
      <Stack.Screen name="progression/[id]" options={{ presentation: 'card' }} />
      <Stack.Screen name="month/theme" options={{ presentation: 'card' }} />
      <Stack.Screen name="year/[year]" options={{ presentation: 'card' }} />
      <Stack.Screen name="year/direction" options={{ presentation: 'card' }} />
      {/* The opening screens replace the tabs rather than sitting over them:
          there is nothing behind them yet to go back to. */}
      <Stack.Screen name="onboarding/direction" options={{ presentation: 'card' }} />
      <Stack.Screen name="onboarding/desired" options={{ presentation: 'card' }} />
      <Stack.Screen name="onboarding/lens" options={{ presentation: 'card' }} />
      <Stack.Screen name="onboarding/theme" options={{ presentation: 'card' }} />
    </Stack>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.ink },
  loading: { flex: 1, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center' },
});
