import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { HIT_SLOP, MIN_TOUCH, colors, fonts, radii, spacing } from '@/theme';
import { COPY, LOCAL_COPY } from '@/constants/copy';
import { Screen } from '@components/ui/Screen';
import { currentAccount, signOutEverywhere } from '@/lib/session';
import {
  NOTIFY_DEFAULT,
  NOTIFY_HOURS,
  applyNotify,
  loadNotify,
  notificationsAvailable,
  saveNotify,
  type NotifySetting,
} from '@/lib/notify';
import { useExport } from '@/hooks/useExport';
import { useLocalStore } from '@/lib/env';

/**
 * マイページ — 通知 / 記録の書き出し / アカウント.
 *
 * All three are on screen whether or not they do anything, which is the
 * preview's arrangement and the right one: a settings screen that grows items
 * as they are built never tells you what the app intends to be, and an item
 * that appears one day looks like something you missed. What changes is
 * whether an item opens — an item that opens onto nothing is worse than one
 * that does not open, so the ones without a working home stay shut and say why.
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

        {COPY.settingsItems.map(([id, title, body]) => {
          const openable =
            (id === 'notify' && notificationsAvailable) ||
            id === 'export' ||
            (id === 'account' && !useLocalStore);
          return (
            <View key={id}>
              <Pressable
                testID={`settings-${id}`}
                onPress={() => setOpen((current) => (current === id ? null : id))}
                disabled={!openable}
                accessibilityRole="button"
                accessibilityLabel={title}
                accessibilityState={{ expanded: open === id }}
                style={({ pressed }) => [styles.card, pressed && styles.pressed]}
              >
                <Text style={styles.cardTitle}>{title}</Text>
                <Text style={styles.cardBody}>{body}</Text>
                {id === 'notify' && !notificationsAvailable ? (
                  <Text style={styles.cardBody}>{LOCAL_COPY.notifyWebOnly}</Text>
                ) : null}
              </Pressable>

              {open === id && openable ? (
                <View style={styles.panel} testID={`settings-${id}-open`}>
                  {id === 'notify' ? <NotifyPanel /> : null}
                  {id === 'export' ? <ExportPanel /> : null}
                  {id === 'account' ? <AccountPanel email={account?.email ?? null} /> : null}
                </View>
              ) : null}
            </View>
          );
        })}
      </ScrollView>
    </Screen>
  );
}

/**
 * 通知.
 *
 * The switch is only believed once the system agrees. If permission is
 * refused the setting goes back off and says so, rather than sitting on and
 * silent — a toggle that lies about whether it is working is the reason people
 * stop trusting settings screens.
 */
function NotifyPanel() {
  const [setting, setSetting] = useState<NotifySetting>(NOTIFY_DEFAULT);
  const [refused, setRefused] = useState(false);

  useEffect(() => {
    let alive = true;
    void loadNotify().then((loaded) => {
      if (alive) setSetting(loaded);
    });
    return () => {
      alive = false;
    };
  }, []);

  const change = async (next: NotifySetting) => {
    setSetting(next);
    const ok = await applyNotify(next);
    if (!ok && next.enabled) {
      setRefused(true);
      const off = { ...next, enabled: false };
      setSetting(off);
      await saveNotify(off);
      return;
    }
    setRefused(false);
    await saveNotify(next);
  };

  return (
    <>
      <Pressable
        testID="notify-toggle"
        onPress={() => void change({ ...setting, enabled: !setting.enabled })}
        hitSlop={HIT_SLOP}
        accessibilityRole="switch"
        accessibilityState={{ checked: setting.enabled }}
        accessibilityLabel={LOCAL_COPY.notifyOn}
        style={({ pressed }) => [styles.toggle, pressed && styles.pressed]}
      >
        <Text style={[styles.toggleMark, setting.enabled && styles.toggleOn]}>
          {setting.enabled ? '●' : '○'}
        </Text>
        <Text style={styles.toggleLabel}>{LOCAL_COPY.notifyOn}</Text>
      </Pressable>

      <Text style={styles.eyebrow}>{LOCAL_COPY.notifyWhen}</Text>
      <View style={styles.hours}>
        {NOTIFY_HOURS.map((hour) => (
          <Pressable
            key={hour}
            testID={`notify-hour-${hour}`}
            onPress={() => void change({ ...setting, hour, minute: 0 })}
            accessibilityRole="button"
            accessibilityState={{ selected: setting.hour === hour }}
            accessibilityLabel={`${hour}時`}
            style={({ pressed }) => [
              styles.hour,
              setting.hour === hour && styles.hourOn,
              pressed && styles.pressed,
            ]}
          >
            <Text style={[styles.hourLabel, setting.hour === hour && styles.hourLabelOn]}>
              {`${hour}:00`}
            </Text>
          </Pressable>
        ))}
      </View>

      {refused ? <Text style={styles.warn}>{LOCAL_COPY.notifyRefused}</Text> : null}
      <Text style={styles.note}>{LOCAL_COPY.notifyWhy}</Text>
    </>
  );
}

/** 記録の書き出し. Gathered on the device; nothing is uploaded to make it. */
function ExportPanel() {
  const exporting = useExport();
  return (
    <>
      <Text style={styles.note}>{LOCAL_COPY.exportWhat}</Text>
      <Pressable
        testID="export-run"
        onPress={() => exporting.mutate()}
        disabled={exporting.isPending}
        accessibilityRole="button"
        accessibilityLabel={LOCAL_COPY.exportDo}
        style={({ pressed }) => [styles.action, pressed && styles.pressed]}
      >
        <Text style={styles.actionLabel}>{LOCAL_COPY.exportDo}</Text>
      </Pressable>
      {exporting.isSuccess ? <Text style={styles.note}>{LOCAL_COPY.exportDone}</Text> : null}
      {exporting.isError ? <Text style={styles.warn}>{LOCAL_COPY.exportFailed}</Text> : null}
    </>
  );
}

/** アカウント. Which one, before offering to leave it. */
function AccountPanel({ email }: { email: string | null }) {
  return (
    <>
      <Text style={styles.eyebrow}>{LOCAL_COPY.signedInAs}</Text>
      <Text style={styles.email}>{email ?? '—'}</Text>
      <Pressable
        testID="settings-logout"
        onPress={() => void signOutEverywhere()}
        hitSlop={HIT_SLOP}
        accessibilityRole="button"
        accessibilityLabel={COPY.logout}
        style={({ pressed }) => [styles.action, pressed && styles.pressed]}
      >
        <Text style={styles.actionLabel}>{COPY.logout}</Text>
      </Pressable>
    </>
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
  panel: {
    paddingTop: spacing.md,
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
    alignItems: 'flex-start',
  },
  eyebrow: { fontFamily: fonts.sans, fontSize: 11, letterSpacing: 1.6, color: colors.brownFaint },
  email: { fontFamily: fonts.sans, fontSize: 14, color: colors.brown },
  toggle: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: 4 },
  toggleMark: { fontFamily: fonts.sans, fontSize: 14, color: colors.brownFaint },
  toggleOn: { color: colors.orange },
  toggleLabel: { fontFamily: fonts.sans, fontSize: 14, color: colors.brown },
  hours: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  hour: {
    minHeight: MIN_TOUCH - 12,
    paddingHorizontal: spacing.md,
    justifyContent: 'center',
    borderRadius: radii.pill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'transparent',
  },
  hourOn: { borderColor: colors.hairline, backgroundColor: colors.butter },
  hourLabel: { fontFamily: fonts.sans, fontSize: 13, color: colors.brownFaint },
  hourLabelOn: { color: colors.brown },
  action: {
    minHeight: MIN_TOUCH,
    marginTop: spacing.xs,
    paddingHorizontal: spacing.lg,
    justifyContent: 'center',
    borderRadius: radii.pill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.hairline,
  },
  actionLabel: { fontFamily: fonts.sans, fontSize: 14, color: colors.brownDim },
  warn: { fontFamily: fonts.sans, fontSize: 12, lineHeight: 21, color: colors.orange },
  note: { fontFamily: fonts.sans, fontSize: 12, lineHeight: 21, color: colors.brownFaint },
});
