/**
 * Reading records that were never read.
 *
 * Analysis normally runs on save, so records that arrived any other way — an
 * import, a stretch spent offline — sit in LIST with nothing behind them and
 * MAP stays empty. This walks them through the same Edge Function a save
 * would have used. It is not a different pipeline; it is the same one, late.
 *
 * Two rules the ordering of this file exists to keep:
 *
 * Oldest first, one at a time. STAGE 2 compares a record with what came
 * before it and writes progressions as it goes, so reading September before
 * June would build a history out of order and the maturity of everything
 * downstream would be wrong. Running them in parallel would do the same thing
 * with extra steps.
 *
 * A record that fell back to the local reading is reported, not counted as
 * read. `analyzeLog` never fails loudly — it keeps the person's record no
 * matter what the network does — which is right during a save and wrong here,
 * where someone is paying per record and deserves to know how many actually
 * reached the model.
 */
import { analyzeLog } from './client';
import { getRepository } from '@/data';
import { monthKeysBetween, monthKeyOf, shiftMonthKey } from '@/utils/period';
import type { DailyLog } from '@/types';

export interface BackfillProgress {
  /** How many records have been attempted, including any that fell back. */
  done: number;
  total: number;
  /** The record just attempted. */
  current: DailyLog;
  readByModel: boolean;
}

export interface BackfillResult {
  attempted: number;
  read: number;
  /** Attempted but answered by the local path — the model was not reached. */
  fellBack: number;
  stopped: boolean;
}

/** The last `count` months, ending with the one we are in. */
export function recentMonths(count: number, now = new Date()): string[] {
  const last = monthKeyOf(now);
  return monthKeysBetween(shiftMonthKey(last, -(count - 1)), last);
}

/**
 * The records in those months that have never been read, oldest first.
 *
 * Ordering here is the whole point, so it sorts on the timestamp rather than
 * trusting the order each month came back in.
 */
export async function collectUnread(months: readonly string[]): Promise<DailyLog[]> {
  const repository = getRepository();
  const found: DailyLog[] = [];

  for (const month of months) {
    const entries = await repository.listLogsByMonth(month);
    for (const entry of entries) {
      if (entry.analysis) continue;
      const { analysis: _analysis, progressions: _progressions, ...log } = entry;
      found.push(log);
    }
  }

  return found.sort((a, b) => a.occurredAt.localeCompare(b.occurredAt));
}

export interface BackfillOptions {
  onProgress?: (progress: BackfillProgress) => void;
  /** Checked between records. A run is never abandoned mid-record. */
  shouldStop?: () => boolean;
}

export async function runBackfill(
  logs: readonly DailyLog[],
  { onProgress, shouldStop }: BackfillOptions = {}
): Promise<BackfillResult> {
  let read = 0;
  let fellBack = 0;
  let done = 0;

  for (const log of logs) {
    // Between records, not during one: a half-read record would leave the
    // analysis stored and the progressions not.
    if (shouldStop?.()) {
      return { attempted: done, read, fellBack, stopped: true };
    }

    const outcome = await analyzeLog(log);
    done += 1;
    if (outcome.offline) fellBack += 1;
    else read += 1;

    onProgress?.({ done, total: logs.length, current: log, readByModel: !outcome.offline });
  }

  return { attempted: done, read, fellBack, stopped: false };
}
