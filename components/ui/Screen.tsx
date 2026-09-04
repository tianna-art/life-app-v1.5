import type { ReactNode } from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';
import { colors, spacing } from '@/theme';

interface ScreenProps {
  children: ReactNode;
  style?: ViewStyle;
  edges?: readonly Edge[];
}

/** The gallery ground every screen sits on. */
export function Screen({ children, style, edges = ['top'] }: ScreenProps) {
  return (
    <View style={styles.root}>
      <SafeAreaView style={styles.safe} edges={edges}>
        <View style={[styles.inner, style]}>{children}</View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.ink },
  safe: { flex: 1 },
  inner: { flex: 1, paddingHorizontal: spacing.gallery },
});
