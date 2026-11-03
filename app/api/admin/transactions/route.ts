import { fail, ok } from '@/lib/api';
import { buildTxWhere, loadTransactions, txQuerySchema } from '../_lib/transactions';
import { parseQuery, requireAdmin } from '../_lib/scope';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const user = await requireAdmin();
    const query = parseQuery(request, txQuerySchema);
    const where = buildTxWhere(user, query);
    const { rows, total, summary } = await loadTransactions(where, {
      page: query.page,
      pageSize: query.pageSize,
    });

    return ok({
      rows,
      total,
      page: query.page,
      pageSize: query.pageSize,
      summary,
    });
  } catch (error) {
    return fail(error);
  }
}
