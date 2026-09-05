#!/usr/bin/env node
/**
 * Copies the canonical progression rules into the Edge Function runtime.
 *
 * The Deno functions cannot import from `src/`, and the rules must not drift:
 * one file is the source, the other is a copy, and a test compares them. If
 * they ever disagree, the offline path and the online path could make claims
 * of different strengths about the same evidence — which is the one thing the
 * rules exist to prevent.
 */
import { copyFileSync } from 'node:fs';

const SOURCE = 'src/ai/progressionRules.ts';
const TARGET = 'supabase/functions/_shared/progressionRules.ts';

copyFileSync(SOURCE, TARGET);
console.log(`synced ${SOURCE} -> ${TARGET}`);
