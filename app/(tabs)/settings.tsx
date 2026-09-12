import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { HIT_SLOP, MIN_TOUCH, colors, fonts, radii, spacing } from '@/theme';
import { COPY, LOCAL_COPY } from '@/constants/copy';
import { Screen } from '@components/ui/Screen';
import { currentAccount, signOutEverywhere } from '@/lib/session';
import { useLocalStore } from '@/lib/env';

/**
 * マイページ — 通知 / 記録の書き出し / アカウント.
 *
 * Two of the three are empty and say so. The preview puts all three on screen
 * before any of them works, and that is right: a settings screen that grows
 * items as they are built never tells you what the app intends to be, and an
 * item that appears one day looks like something you missed.
 *
 * アカウント is the one with something behind it, because ログアウト had
 * nowhere to live. It shows which account is signed in before offering to
 * leave it — signing out of the wrong one is easy when you are not told.
 *
 * ビジョンボード does not live here: it opens and closes on the map.
 */
export default function SettingsScreen() {
  const [open, setOpen] = useState<string | null>(null);
  const { data: account } = useQuery({
    queryKey: ['account'],
    queryFn: currentAccount,
    enabled: !useLocalStore,
  });

  return (
    <Screen>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        <Text style={styles.heading} accessibilityRole="header">
          {COPY.settingsTitle}
        </Text>

        {COPY.settingsItems.map(([id, title, body]) => (
          <View key={id}>
            <Pressable
              testID={`settings-${id}`}
              onPress={() => setOpen((current) => (current === id ? null : id))}
              // 通知 and 記録の書き出し open onto nothing, so they do not open.
              // Neither does アカウント in local-store mode: there is no
              // session to show and none to end, and an item that opens onto a
              // dead ログアウト is worse than one that does not open.
              disabled={id !== 'account' || useLocalStore}
              accessibilityRole="button"
              accessibilityLabel={title}
              accessibilityState={{ expanded: open === id }}
              style={({ pressed }) => [styles.card, pressed && styles.pressed]}
            >
              <Text style={styles.cardTitle}>{title}</Text>
              <Text style={styles.cardBody}>{body}</Text>
            </Pressable>

            {id === 'account' && open === 'account' ? (
              <View style={styles.account} testID="settings-account-open">
                <Text style={styles.eyebrow}>{LOCAL_COPY.signedInAs}</Text>
                <Text style={styles.email}>{account?.email ?? '—'}</Text>
                <Pressable
                  testID="settings-logout"
                  onPress={() => void signOutEverywhere()}
                  hitSlop={HIT_SLOP}
                  accessibilityRole="button"
                  accessibilityLabel={COPY.logout}
                  style={({ pressed }) => [styles.logout, pressed && styles.pressed]}
                >
                  <Text style={styles.logoutLabel}>{COPY.logout}</Text>
                </Pressable>
              </View>
            ) : null}
          </View>
        ))}

        <Text style={styles.note}>{LOCAL_COPY.settingsNote}</Text>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingTop: spacing.lg, paddingBottom: spacing.xxl, gap: spacing.sm },
  heading: { fontFamily: fonts.serif, fontSize: 22, lineHeight: 31, color: colors.brown },
  card: {
    backgroundColor: colors.paper,
    borderRadius: radii.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.hairline,
    padding: spacing.lg,
    gap: 2,
  },
  pressed: { opacity: 0.62 },
  cardTitle: { fontFamily: fonts.serif, fontSize: 16, color: colors.brown },
  cardBody: { fontFamily: fonts.sans, fontSize: 12, lineHeight: 21, color: colors.brownFaint },
  account: {
    paddingTop: spacing.md,
    paddingHorizontal: spacing.lg,
    gap: spacing.xs,
    alignItems: 'flex-start',
  },
  eyebrow: { fontFamily: fonts.sans, fontSize: 11, letterSpacing: 1.6, color: colors.brownFaint },
  email: { fontFamily: fonts.sans, fontSize: 14, color: colors.brown },
  logout: {
    minHeight: MIN_TOUCH,
    marginTop: spacing.sm,
    paddingHorizontal: spacing.lg,
    justifyContent: 'center',
    borderRadius: radii.pill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.hairline,
  },
  logoutLabel: { fontFamily: fonts.sans, fontSize: 14, color: colors.brownDim },
  note: {
    fontFamily: fonts.sans,
    fontSize: 11,
    lineHeight: 20,
    color: colors.brownFaint,
    paddingTop: spacing.sm,
  },
});
