/**
 * Guardrails on the words themselves: the empty states must never read as a
 * shortfall, and the shipped copy must not contain the forbidden phrasing.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { EMPTY_STATE, LABELS } from '@/constants/copy';

describe('empty states', () => {
  it('use the exact approved wording', () => {
    // The ＋ button is gone — the field is the page now, so the invitation
    // has to point at something that exists.
    expect(EMPTY_STATE.log).toBe('まだ何も残していません。上の欄から、最初の点を置いてみる。');
    expect(EMPTY_STATE.log).not.toContain('＋');
    expect(EMPTY_STATE.map).toBe('この月の空は、まだ静かです。');
    expect(EMPTY_STATE.list).toBe('この月には、まだ記録がありません。');
  });

  it('never frame emptiness as insufficiency', () => {
    for (const message of Object.values(EMPTY_STATE)) {
      expect(message).not.toContain('記録が足りません');
      expect(message).not.toContain('足りません');
    }
  });
});

describe('fixed labels', () => {
  it('keeps 納得した as its own label', () => {
    expect(LABELS.accept).toBe('納得した');
    expect(LABELS.skip).toBe('スキップ');
    expect(LABELS.edit).toBe('編集');
  });
});

function walk(dir: string, files: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry.startsWith('.')) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, files);
    // copy.ts is the allow-list that *declares* the banned phrases, so it is
    // deliberately excluded from the scan of shipped copy.
    else if (/\.(ts|tsx)$/.test(full) && !full.endsWith('constants/copy.ts')) files.push(full);
  }
  return files;
}

describe('shipped source', () => {
  const root = join(__dirname, '..');
  const sources = [
    ...walk(join(root, 'src')),
    ...walk(join(root, 'components')),
    ...walk(join(root, 'app')),
  ];

  it('contains no diagnostic phrasing', () => {
    const banned = ['あなたは', '本当のあなた', '意味がありました', '記録が足りません'];
    const offenders: string[] = [];
    for (const file of sources) {
      const text = readFileSync(file, 'utf8');
      for (const phrase of banned) {
        if (text.includes(phrase)) offenders.push(`${file}: ${phrase}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it('ships none of the excluded MVP features', () => {
    const banned = ['streak', 'ストリーク', 'PieChart', 'follower', 'フォロワー'];
    const offenders: string[] = [];
    for (const file of sources) {
      const text = readFileSync(file, 'utf8');
      for (const phrase of banned) {
        if (text.includes(phrase)) offenders.push(`${file}: ${phrase}`);
      }
    }
    expect(offenders).toEqual([]);
  });
});
