import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * 通知 — 月初と月末に、いつ知らせるか。
 *
 * Two moments and no others, both of them the same kind of thing: a moment
 * when something became possible. The first of the month is when a direction
 * can be put down; the last day is when the period can be named. Neither
 * notification is about what the person did or did not write, because a
 * reminder that counts your records is a reminder that you are behind, and
 * nothing in this product is allowed to say that.
 *
 * So there is no daily 「今日の記録は？」 here, and there will not be one.
 *
 * The first of the month repeats on its own. The last day does not — it is the
 * 28th, 30th or 31st depending on the month — so a year of them is scheduled
 * ahead and re-armed whenever the setting is touched or the app starts.
 */

export interface NotifySetting {
  enabled: boolean;
  /** Local time of day, 0–23. */
  hour: number;
  minute: number;
}

export const NOTIFY_DEFAULT: NotifySetting = { enabled: false, hour: 21, minute: 0 };

/** The times offered. A free picker is more than this setting is worth. */
export const NOTIFY_HOURS = [7, 9, 12, 18, 21] as const;

/** How far ahead the month-end reminders are scheduled. */
export const MONTH_ENDS_AHEAD = 12;

const KEY = 'crincran.notify.v1';

/**
 * Notifications are a phone thing. On the web the setting is not offered at
 * all rather than offered and quietly ineffective.
 */
export const notificationsAvailable = Platform.OS === 'ios' || Platform.OS === 'android';

export async function loadNotify(): Promise<NotifySetting> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return NOTIFY_DEFAULT;
    const parsed = JSON.parse(raw) as Partial<NotifySetting>;
    return {
      enabled: Boolean(parsed.enabled),
      hour: typeof parsed.hour === 'number' ? parsed.hour : NOTIFY_DEFAULT.hour,
      minute: typeof parsed.minute === 'number' ? parsed.minute : NOTIFY_DEFAULT.minute,
    };
  } catch {
    return NOTIFY_DEFAULT;
  }
}

export async function saveNotify(setting: NotifySetting): Promise<void> {
  await AsyncStorage.setItem(KEY, JSON.stringify(setting));
}

/**
 * The last day of each of the next months, at the chosen time.
 *
 * Today counts only if the time has not already gone by — a reminder fired for
 * a moment that has passed is worse than none, because it teaches that the
 * reminders are not about the moment.
 */
export function monthEndDates(
  from: Date,
  count: number,
  hour: number,
  minute: number
): Date[] {
  const dates: Date[] = [];
  for (let i = 0; i < count; i += 1) {
    const month = new Date(from.getFullYear(), from.getMonth() + i, 1);
    // Day 0 of the next month is the last day of this one — which is how
    // February, and February in a leap year, get the right answer for free.
    const last = new Date(month.getFullYear(), month.getMonth() + 1, 0, hour, minute, 0, 0);
    if (last.getTime() > from.getTime()) dates.push(last);
  }
  return dates;
}

/** What each one says. Announcements of what became possible, never arrears. */
export const NOTIFY_TEXT = {
  monthStart: { title: '新しい月', body: '今月の方向を置けます。' },
  monthEnd: { title: '月の終わり', body: '今月の足跡タイトルを付けられます。' },
} as const;

/**
 * Puts the setting into effect: clears whatever was scheduled and, if it is
 * on, schedules the two kinds again.
 *
 * Returns false when the person has not granted permission — the caller turns
 * the setting back off rather than leaving it on and silent.
 */
export async function applyNotify(setting: NotifySetting, now = new Date()): Promise<boolean> {
  if (!notificationsAvailable) return false;
  const Notifications = await import('expo-notifications');

  await Notifications.cancelAllScheduledNotificationsAsync();
  if (!setting.enabled) return true;

  const permission = await Notifications.getPermissionsAsync();
  const granted =
    permission.granted || (await Notifications.requestPermissionsAsync()).granted;
  if (!granted) return false;

  const { SchedulableTriggerInputTypes } = Notifications;

  await Notifications.scheduleNotificationAsync({
    content: { ...NOTIFY_TEXT.monthStart },
    trigger: {
      type: SchedulableTriggerInputTypes.MONTHLY,
      day: 1,
      hour: setting.hour,
      minute: setting.minute,
    },
  });

  for (const date of monthEndDates(now, MONTH_ENDS_AHEAD, setting.hour, setting.minute)) {
    await Notifications.scheduleNotificationAsync({
      content: { ...NOTIFY_TEXT.monthEnd },
      trigger: { type: SchedulableTriggerInputTypes.DATE, date },
    });
  }

  return true;
}
