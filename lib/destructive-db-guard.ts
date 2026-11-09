const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '::1']);

function isProductionEnvironment() {
  return process.env.NODE_ENV === 'production' || process.env.VERCEL_ENV === 'production';
}

export function isLoopbackDatabaseUrl(value: string | undefined, variableName: string) {
  if (!value) throw new Error(`${variableName} is required for destructive database operations.`);

  let hostname: string;
  try {
    hostname = new URL(value).hostname.toLowerCase();
  } catch {
    throw new Error(`${variableName} must be a valid database URL.`);
  }

  return LOOPBACK_HOSTS.has(hostname) || hostname.endsWith('.localhost');
}

export function assertSafeDestructiveDatabaseOperation() {
  if (isProductionEnvironment()) {
    throw new Error('Destructive database commands are disabled in production environments.');
  }

  if (process.env.ALLOW_DESTRUCTIVE_DB_RESET !== '1') {
    throw new Error(
      'Set ALLOW_DESTRUCTIVE_DB_RESET=1 to confirm that this operation may replace database data.',
    );
  }

  const databaseUrlIsLocal = isLoopbackDatabaseUrl(process.env.DATABASE_URL, 'DATABASE_URL');
  const directUrlIsLocal = isLoopbackDatabaseUrl(process.env.DIRECT_URL, 'DIRECT_URL');
  const local = databaseUrlIsLocal && directUrlIsLocal;

  if (!local && process.env.ALLOW_REMOTE_DB_RESET !== '1') {
    throw new Error(
      'This database is remote. Set ALLOW_REMOTE_DB_RESET=1 as a separate confirmation to continue.',
    );
  }
}
