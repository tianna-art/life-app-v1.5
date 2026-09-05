-- crincran — Lens model, part 1 of 2: enum values only.
--
-- These are split out because Postgres refuses to use a value added by
-- ALTER TYPE ... ADD VALUE inside the same transaction that added it, and the
-- next migration both adds 'self_action' and moves rows onto it. Two files,
-- applied in order, is the whole reason this one exists.
--
-- Re-runnable: IF NOT EXISTS on every statement.

-- Level 1 (§9). 'thought' already means what it means; 'event' becomes the
-- narrower 'self_action', and 'relationship' is the case v3 had nowhere to put.
alter type public.log_type add value if not exists 'self_action';
alter type public.log_type add value if not exists 'relationship';

-- §7 renames the role a record plays in a path: friction, not a setback.
-- 'setback' stays valid so v3 rows keep their meaning.
alter type public.progression_evidence_role add value if not exists 'friction';
