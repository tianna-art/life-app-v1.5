/**
 * What each change answers to, and the order those come in (§14).
 *
 * The five points off ME are not five unrelated things. Each one was published
 * against something the person put down before the month started, and that is
 * the only grouping worth drawing: it turns the sky from "here are five
 * changes" into "here is what moved on what I said I wanted, and here is what
 * moved somewhere else".
 *
 * §14 fixes the order — the month's declaration, then the year's direction,
 * then a desired-self card. `emerging_direction` comes last because it is
 * what the records turned up on their own, and it belongs beside the rest
 * rather than above them: §34 is explicit that growing outside the stated
 * direction is a discovery and not a miss.
 *
 * The gains ride along. §32 puts a gain at the end of a change, so gathering
 * them per group is what answers "and what am I left holding, toward this
 * thing I wanted" — the question §1's GAIN half exists for.
 */
import type { Change, ChangeTargetType, Gain } from '@/types';

export const TARGET_ORDER: readonly ChangeTargetType[] = [
  'month_declaration',
  'year_direction',
  'desired_self',
  'emerging_direction',
] as const;

export interface ChangeGroup {
  /** Stable across renders: the target this group is about. */
  key: string;
  targetType: ChangeTargetType;
  /** The person's own wording for the thing, or the name the records earned. */
  targetLabel: string;
  changes: Change[];
  /** What the changes in this group left behind, each named once. */
  gains: Gain[];
}

/**
 * Group the month's changes by the thing they answer to.
 *
 * By the target itself, not by its kind: two changes moving on the same
 * desired-self card belong together, and saying so is more use than saying
 * they are both "desired_self". The kind still decides the order and is what
 * the sky is labelled with, where there is only room for a short word.
 */
export function groupChanges(changes: readonly Change[]): ChangeGroup[] {
  const groups = new Map<string, ChangeGroup>();

  for (const change of changes) {
    // An emerging direction has no id — nobody chose it — so its label is
    // what identifies it.
    const key = `${change.linkedTargetType}:${change.linkedTargetId ?? change.linkedTargetLabel}`;
    const group = groups.get(key) ?? {
      key,
      targetType: change.linkedTargetType,
      targetLabel: change.linkedTargetLabel,
      changes: [],
      gains: [],
    };
    group.changes.push(change);
    groups.set(key, group);
  }

  for (const group of groups.values()) {
    group.changes.sort((a, b) => a.position - b.position);
    // One gain per label. The same thing settling out of two changes is one
    // thing the person now has, not two.
    const seen = new Set<string>();
    for (const change of group.changes) {
      for (const gain of change.gains) {
        if (seen.has(gain.label)) continue;
        seen.add(gain.label);
        group.gains.push(gain);
      }
    }
  }

  return [...groups.values()].sort((a, b) => {
    const byKind = TARGET_ORDER.indexOf(a.targetType) - TARGET_ORDER.indexOf(b.targetType);
    if (byKind !== 0) return byKind;
    // Within a kind, the order the reading itself chose.
    return (a.changes[0]?.position ?? 0) - (b.changes[0]?.position ?? 0);
  });
}

/** The changes of every group, flattened back into the order they are drawn. */
export function orderedChanges(groups: readonly ChangeGroup[]): Change[] {
  return groups.flatMap((group) => group.changes);
}
