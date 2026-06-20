import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { getTestDatabaseUrl } from './test-database-url';

export default function globalSetup(): void {
  const prismaCli = join(process.cwd(), 'node_modules/prisma/build/index.js');
  execFileSync(process.execPath, [prismaCli, 'migrate', 'deploy'], {
    env: {
      ...process.env,
      DATABASE_URL: getTestDatabaseUrl(),
    },
    stdio: 'inherit',
  });
}
