import { format } from 'date-fns';
import { prisma } from '@/lib/db';
import { fail } from '@/lib/api';
import { resolveTenantScope } from '@/lib/tenant';
import { buildTxWhere, txQuerySchema } from '../../_lib/transactions';
import { serializeTx, txInclude } from '../../_lib/serializers';
import { parseQuery, requireAdmin } from '../../_lib/scope';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_EXPORT_ROWS = 5000;

function csvCell(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '';
  let text = String(value);
  // Prevent spreadsheet formula injection from user-controlled names/notes.
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  if (/[",\n\r]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

/**
 * Downloadable transaction ledger. Real file download — the admin UI points an
 * anchor straight at this handler with the same filters as the on-screen table.
 */
export async function GET(request: Request) {
  try {
    const user = await requireAdmin();
    const query = parseQuery(request, txQuerySchema);
    const scope = resolveTenantScope(user, query.universityId);
    const where = buildTxWhere(user, query);

    const [records, university] = await Promise.all([
      prisma.transaction.findMany({
        where,
        include: txInclude,
        orderBy: { createdAt: 'desc' },
        take: MAX_EXPORT_ROWS,
      }),
      scope
        ? prisma.university.findUnique({ where: { id: scope }, select: { code: true } })
        : Promise.resolve(null),
    ]);

    const rows = records.map(serializeTx);
    const header = [
      'Reference',
      'Date',
      'Type',
      'Status',
      'Student',
      'Student ID',
      'Student phone',
      'Vendor',
      'Amount (TZS)',
      'Platform fee',
      'University revenue',
      'Channel',
      'Details',
    ];

    const lines = rows.map((row) =>
      [
        row.reference,
        format(new Date(row.createdAt), 'yyyy-MM-dd HH:mm'),
        row.typeLabel,
        row.status,
        row.student.name,
        row.student.studentId,
        row.student.phone,
        row.vendor?.name ?? '',
        row.amount,
        row.platformFee,
        row.universityRevenue,
        row.channel,
        row.metadataSummary ?? '',
      ]
        .map(csvCell)
        .join(','),
    );

    const csv = `\uFEFF${header.map(csvCell).join(',')}\r\n${lines.join('\r\n')}\r\n`;
    const stamp = format(new Date(), 'yyyyMMdd');
    const tenantCode = university?.code ?? 'ALL';

    return new Response(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="kupon-${tenantCode}-transactions-${stamp}.csv"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    return fail(error);
  }
}
