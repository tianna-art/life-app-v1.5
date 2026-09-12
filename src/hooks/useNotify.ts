import { useEffect } from 'react';
import { applyNotify, loadNotify, notificationsAvailable } from '@/lib/notify';

/**
 * Re-arms the month-end reminders when the app starts.
 *
 * The first of the month repeats by itself; the last day cannot, because it
 * moves. A year of them is scheduled ahead, so this only has to run often
 * enough to top the queue up — which opening the app does.
 */
export function useNotifySchedule(): void {
  useEffect(() => {
    if (!notificationsAvailable) return;
    void loadNotify().then((setting) => {
      // Nothing is asked for and nothing is scheduled unless it is already on:
      // starting the app is not consent.
      if (setting.enabled) void applyNotify(setting);
    });
  }, []);
}
