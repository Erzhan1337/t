const defaultDatabaseUrl =
  'postgresql://postgres:postgres@localhost:5432/opkit';

export function getTestDatabaseUrl(): string {
  const databaseUrl = new URL(
    process.env.TEST_DATABASE_URL ?? defaultDatabaseUrl,
  );
  if (!databaseUrl.searchParams.has('schema')) {
    databaseUrl.searchParams.set('schema', 'opkit_test');
  }
  return databaseUrl.toString();
}
