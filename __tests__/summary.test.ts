/**
 * 要約 has two bodies, and which one is shown is the whole point of keeping
 * them apart: the reading can be regenerated without discarding what the
 * person wrote over it.
 */
import { summaryText, type PeriodSummary } from '@/types';

function summary(over: Partial<PeriodSummary> = {}): PeriodSummary {
  return {
    periodType: 'month',
    periodKey: '2026-09',
    keywords: ['整理', '裁量', '継続'],
    body: '読みが書いた本文。',
    bodyUser: null,
    updatedAt: '2026-10-01T00:00:00Z',
    ...over,
  };
}

describe('which body is shown', () => {
  it('shows the reading when the person has not written one', () => {
    expect(summaryText(summary())).toBe('読みが書いた本文。');
  });

  it('shows the person’s words once they have', () => {
    expect(summaryText(summary({ bodyUser: '自分で書いた本文。' }))).toBe('自分で書いた本文。');
  });

  it('falls back rather than showing a blank month', () => {
    expect(summaryText(summary({ bodyUser: '   ' }))).toBe('読みが書いた本文。');
    expect(summaryText(summary({ bodyUser: '' }))).toBe('読みが書いた本文。');
  });

  it('shows the person’s words even when the reading has none', () => {
    // Writing your own summary before any reading exists is allowed.
    expect(summaryText(summary({ body: '', bodyUser: '先に自分で書いた。' }))).toBe(
      '先に自分で書いた。'
    );
  });

  it('keeps the reading intact underneath, so regenerating it loses nothing', () => {
    const edited = summary({ bodyUser: '書き直した。' });
    expect(edited.body).toBe('読みが書いた本文。');
    expect(edited.keywords).toEqual(['整理', '裁量', '継続']);
  });
});

describe('what the database allows', () => {
  const migration = require('node:fs').readFileSync(
    require('node:path').join(__dirname, '..', 'supabase/migrations/20260912120000_direction_model.sql'),
    'utf8'
  ) as string;

  it('lets a client write only its own half of the summary', () => {
    expect(migration).toContain('grant update (body_user, updated_at) on public.period_summaries');
    expect(migration).toContain('revoke insert, update, delete on public.period_summaries');
  });

  it('still refuses a client-written 見立て or 仮説', () => {
    expect(migration).toMatch(/month_insights', 'month_hypotheses'/);
    expect(migration).toContain("revoke insert, update, delete on public.%I from authenticated");
  });

  it('keeps a month key out of a year row', () => {
    expect(migration).toContain('period_summaries_key_matches_type');
  });
});
