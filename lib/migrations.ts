export const currentContentSchemaVersion = 2;
export const currentCoreVersion = '0.1.0';

export interface MigrationRecord {
  publicId: string;
  version: number;
  appliedAt: number;
}

export function applyMigrations<T extends { migrations?: MigrationRecord[] }>(state: T, createId: () => string, now: () => number) {
  state.migrations ??= [];
  const applied: MigrationRecord[] = [];
  const projectState = state as T & { projects?: { projectType?: string }[] };
  if (!state.migrations.some((record) => record.version === currentContentSchemaVersion)) {
    for (const project of projectState.projects ?? []) project.projectType ??= 'case-study';
    const record = { publicId: createId(), version: currentContentSchemaVersion, appliedAt: now() };
    state.migrations.push(record);
    applied.push(record);
  }
  return applied;
}

export function migrationStatus(migrations: MigrationRecord[] | undefined) {
  const versions = new Set((migrations ?? []).map((record) => record.version));
  return { current: currentContentSchemaVersion, applied: [...versions].sort((left, right) => left - right), ready: versions.has(currentContentSchemaVersion) };
}
