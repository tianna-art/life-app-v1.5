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
import { useNotifySchedule } from '@/hooks/useNotify';
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
  useNotifySchedule();

  if (auth.loading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={colors.orange} />
      </View>
    );
  }

  if (!auth.ready) return <AuthGate auth={auth} />;

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.cream },
        animation: 'fade',
      }}
    >
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="vision/setup" options={{ presentation: 'card' }} />
      <Stack.Screen name="direction/year" options={{ presentation: 'card' }} />
      <Stack.Screen name="direction/month" options={{ presentation: 'card' }} />
      <Stack.Screen name="records/[ids]" options={{ presentation: 'card' }} />
    </Stack>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.cream },
  loading: { flex: 1, backgroundColor: colors.cream, alignItems: 'center', justifyContent: 'center' },
});
