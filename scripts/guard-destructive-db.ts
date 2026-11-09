import { assertSafeDestructiveDatabaseOperation } from '../lib/destructive-db-guard';

try {
  assertSafeDestructiveDatabaseOperation();
} catch (error) {
  console.error(error instanceof Error ? error.message : 'Destructive database operation refused.');
  process.exit(1);
}
