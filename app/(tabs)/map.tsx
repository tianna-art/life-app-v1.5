import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { HIT_SLOP, MIN_TOUCH, colors, fonts, radii, spacing } from '@/theme';
import { COPY } from '@/constants/copy';
import { Screen } from '@components/ui/Screen';
import { HairlineRule } from '@components/ui/HairlineRule';
import { VisionBoard } from '@components/vision/VisionBoard';
import { SectionHeading } from '@components/map/SectionHeading';
import { DirectionPlates } from '@components/map/DirectionPlates';
import { InsightCards } from '@components/map/InsightCards';
import { StarredMemos } from '@components/map/StarredMemos';
import { useVision } from '@/hooks/useVision';
import { useMonthDirection, useYearDirection } from '@/hooks/useDirection';
import { useMonthHypothesis, useMonthInsights } from '@/hooks/useReading';
import { useFutureMemos } from '@/hooks/useFutureMemos';
import { usePeriodTitles } from '@/hooks/usePeriodTitles';
import { monthKeyOf } from '@/utils/period';

type Scope = 'now' | 'month' | 'year';

/**
 * 方向性マップ — home, opening on 現在地.
 *
 * Three bands, in this order and no other: 方向を定める (what you are looking
 * at), 今を見つめる (what the records and what is on your mind say about now),
 * 足跡がつく (the name that will be given afterwards). Reading downward is the
 * argument — a direction, then the present, then the record of having lived
 * it. Never a score in between.
 */
export default function MapScreen() {
  const router = useRouter();
  const today = useMemo(() => new Date(), []);
  const periodKey = useMemo(() => monthKeyOf(today), [today]);
  const year = today.getFullYear();

  const [scope, setScope] = useState<Scope>('now');
  const [visionOpen, setVisionOpen] = useState(true);

  const { data: vision } = useVision();
  const { data: yearDirection } = useYearDirection(year);
  const { data: monthDirection } = useMonthDirection(periodKey);
  const { data: insights } = useMonthInsights(periodKey);
  const { data: hypothesis } = useMonthHypothesis(periodKey);
  const { data: memos } = useFutureMemos();
  const { data: monthTitles } = usePeriodTitles('month');

  const title = (monthTitles ?? []).find((t) => t.periodKey === periodKey);

  return (
    <Screen>
      <View style={styles.scopes}>
        {(
          [
            ['now', '現在地'],
            ['month', '月次'],
            ['year', '年次'],
          ] as [Scope, string][]
        ).map(([id, label]) => (
          <Pressable
            key={id}
            testID={`map-scope-${id}`}
            onPress={() => setScope(id)}
            hitSlop={HIT_SLOP}
            accessibilityRole="tab"
            accessibilityState={{ selected: scope === id }}
            style={({ pressed }) => [
              styles.scope,
              scope === id && styles.scopeOn,
              pressed && styles.pressed,
            ]}
          >
            <Text style={[styles.scopeLabel, scope === id && styles.scopeLabelOn]}>{label}</Text>
          </Pressable>
        ))}
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        {scope !== 'now' ? (
          <View style={styles.pending}>
            <Text style={styles.pendingText}>
              {scope === 'month' ? COPY.digestPending : COPY.yearDigestPending}
            </Text>
          </View>
        ) : (
          <>
            <VisionBoard
              items={vision?.items ?? []}
              words={vision?.words ?? []}
              open={visionOpen}
              onToggle={() => setVisionOpen((v) => !v)}
              onStart={() => router.push('/vision/setup')}
            />

            <HairlineRule />

            <SectionHeading number={1} title={COPY.secDirection} sub={COPY.secDirectionSub} />
            <DirectionPlates
              year={year}
              month={today.getMonth() + 1}
              yearDirection={yearDirection?.direction ?? null}
              antennaIds={monthDirection?.antennaIds ?? []}
              onEditYear={() => router.push('/direction/year')}
              onEditMonth={() => router.push('/direction/month')}
            />

            <SectionHeading number={2} title={COPY.seenNow} sub={COPY.seenSub} />

            <Text style={styles.subHead}>{COPY.subOccurred}</Text>
            <Text style={styles.subSub}>{COPY.subOccurredSub}</Text>
            <InsightCards
              insights={insights ?? []}
              hypothesis={hypothesis ?? null}
              onOpen={(insight) => router.push(`/records/${insight.evidenceLogIds.join(',')}`)}
            />
            <Pressable
              testID="map-write"
              onPress={() => router.push('/log')}
              accessibilityRole="button"
              accessibilityLabel={COPY.addPoint}
              style={({ pressed }) => [styles.write, pressed && styles.pressed]}
            >
              <Text style={styles.writeLabel}>{COPY.addPoint}</Text>
            </Pressable>

            <Text style={styles.subHead}>{COPY.subInMind}</Text>
            <Text style={styles.subSub}>{COPY.subInMindSub}</Text>
            <StarredMemos
              memos={memos ?? []}
              onSeeAll={() => router.push('/log')}
              onAdd={() => router.push('/log')}
            />

            <SectionHeading number={3} title={COPY.secFootprint} sub={COPY.secFootprintSub} />
            <View style={styles.footprint}>
              <Text style={title ? styles.footprintTitle : styles.footprintWait}>
                {title?.title ?? COPY.footprintWait}
              </Text>
            </View>
          </>
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scopes: { flexDirection: 'row', gap: spacing.sm, paddingTop: spacing.md, justifyContent: 'center' },
  scope: {
    minHeight: MIN_TOUCH - 12,
    paddingHorizontal: spacing.lg,
    justifyContent: 'center',
    borderRadius: radii.pill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'transparent',
  },
  scopeOn: { borderColor: colors.hairline, backgroundColor: colors.paper },
  scopeLabel: { fontFamily: fonts.sans, fontSize: 13, color: colors.brownFaint },
  scopeLabelOn: { color: colors.brown },
  pressed: { opacity: 0.62 },
  scroll: { paddingTop: spacing.md, paddingBottom: spacing.xxl, gap: spacing.md },
  // 月次 and 年次 are built in Phase 4, once there is a reading to show. They
  // say what they are waiting for rather than showing an empty frame.
  pending: {
    backgroundColor: colors.butter,
    borderRadius: radii.lg,
    padding: spacing.lg,
    alignItems: 'center',
  },
  pendingText: { fontFamily: fonts.sans, fontSize: 13, lineHeight: 22, color: colors.brownDim },
  subHead: { fontFamily: fonts.serif, fontSize: 15, color: colors.brown, paddingTop: spacing.sm },
  subSub: { fontFamily: fonts.sans, fontSize: 11, color: colors.brownFaint },
  write: {
    minHeight: MIN_TOUCH + 6,
    borderRadius: radii.pill,
    backgroundColor: colors.brown,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.sm,
  },
  writeLabel: { fontFamily: fonts.sans, fontSize: 15, color: colors.onBrown },
  footprint: {
    borderRadius: radii.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.hairline,
    padding: spacing.lg,
    alignItems: 'center',
  },
  footprintTitle: { fontFamily: fonts.serif, fontSize: 16, lineHeight: 26, color: colors.brown, textAlign: 'center' },
  footprintWait: {
    fontFamily: fonts.sans,
    fontSize: 12,
    lineHeight: 21,
    color: colors.brownFaint,
    textAlign: 'center',
  },
});
