import { useLocalStore } from '@/lib/env';
import { LocalRepository } from './localRepository';
import { SupabaseRepository } from './supabaseRepository';
import type { Repository } from './repository';

let instance: Repository | null = null;

/**
 * The active repository. Supabase is the shipped path; the local store is used
 * only when the project has no Supabase configuration yet.
 */
export function getRepository(): Repository {
  if (!instance) {
    instance = useLocalStore ? new LocalRepository() : new SupabaseRepository();
  }
  return instance;
}

/** Test seam. */
export function setRepository(repository: Repository | null): void {
  instance = repository;
}

export { LocalRepository, SupabaseRepository };
export type { Repository };
