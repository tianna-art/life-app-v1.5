#!/usr/bin/env node
/**
 * Copies the canonical gain rules into the Edge Function runtime.
 *
 * The Deno functions cannot import from `src/`, and the rules must not drift:
 * one file is the source, the other is a copy, and a test compares them.
 */
import { copyFileSync } from 'node:fs';

const SOURCE = 'src/ai/gainRules.ts';
const TARGET = 'supabase/functions/_shared/gainRules.ts';

copyFileSync(SOURCE, TARGET);
console.log(`synced ${SOURCE} -> ${TARGET}`);
