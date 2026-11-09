import { isLoopbackDatabaseUrl } from '../lib/destructive-db-guard';

if (process.env.NODE_ENV === 'production' || process.env.VERCEL_ENV === 'production') {
  console.error('Direct schema pushes are disabled in production. Use reviewed Prisma migrations.');
  process.exit(1);
}

const databaseUrlIsLocal = isLoopbackDatabaseUrl(process.env.DATABASE_URL, 'DATABASE_URL');
const directUrlIsLocal = isLoopbackDatabaseUrl(process.env.DIRECT_URL, 'DIRECT_URL');
if (
  (!databaseUrlIsLocal || !directUrlIsLocal) &&
  process.env.ALLOW_REMOTE_SCHEMA_PUSH !== '1'
) {
  console.error('This database is remote. Set ALLOW_REMOTE_SCHEMA_PUSH=1 as a separate confirmation.');
  process.exit(1);
}

if (process.env.ALLOW_SCHEMA_PUSH !== '1') {
  console.error('Set ALLOW_SCHEMA_PUSH=1 to confirm a direct schema push for this non-production database.');
  process.exit(1);
}
