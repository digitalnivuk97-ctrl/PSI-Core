import { describe, expect, it } from 'vitest';
import { applyMigrations, migrationStatus } from '@/lib/migrations';

describe('content migrations', () => {
  it('applies the current schema once and reports readiness', () => {
    const state: { migrations?: { publicId: string; version: number; appliedAt: number }[] } = {};
    const applied = applyMigrations(state, () => 'migration-1', () => 10);
    expect(applied).toHaveLength(1);
    expect(applyMigrations(state, () => 'migration-2', () => 11)).toHaveLength(0);
    expect(migrationStatus(state.migrations).ready).toBe(true);
  });
});
