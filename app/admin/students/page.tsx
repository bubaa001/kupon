'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Eye,
  RefreshCw,
  SearchX,
  Users,
  Wallet,
  WalletCards,
} from 'lucide-react';
import { Alert } from '@/components/ui/alert';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Money } from '@/components/ui/money';
import { PageHeader } from '@/components/ui/page-header';
import { PageSkeleton } from '@/components/ui/skeleton';
import { StatCard } from '@/components/ui/stat-card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { formatDate, formatTZS } from '@/lib/utils';
import type { StudentListData, StudentRow } from '../_components/types';
import { queryString, useApiData, useDebouncedValue } from '../_components/hooks';
import {
  AdjustWalletDialog,
  StudentDetailDialog,
  type AdjustTarget,
} from '../_components/student-dialogs';
import {
  Pagination,
  SearchField,
  SectionCard,
  TableEmpty,
} from '../_components/ui-bits';

const PAGE_SIZE = 10;

export default function AdminStudentsPage() {
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search);
  const [page, setPage] = useState(1);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [adjustTarget, setAdjustTarget] = useState<AdjustTarget | null>(null);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch]);

  const url = useMemo(
    () =>
      `/api/admin/students${queryString({
        q: debouncedSearch || undefined,
        page,
        pageSize: PAGE_SIZE,
      })}`,
    [debouncedSearch, page],
  );
  const { data, error, loading, reload } = useApiData<StudentListData>(url);

  function openAdjust(student: StudentRow) {
    setAdjustTarget({
      id: student.id,
      name: student.name,
      studentId: student.studentId,
      balance: student.balance,
    });
  }

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Wallet holders"
        title="Students"
        description="Search campus wallet holders, inspect their history and make audited manual adjustments."
        actions={
          <Button type="button" variant="outline" size="sm" onClick={reload} disabled={loading}>
            <RefreshCw className={loading ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} />
            <span className="hidden sm:inline">Refresh</span>
          </Button>
        }
      />

      {error ? (
        <Alert variant="danger" title="Could not load students">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span>{error}</span>
            <Button type="button" size="sm" variant="outline" onClick={reload}>
              Try again
            </Button>
          </div>
        </Alert>
      ) : null}

      {loading && !data ? (
        <PageSkeleton />
      ) : error && !data ? null : (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <StatCard
              label="Students on Kupon"
              value={data ? String(data.summary.totalStudents) : '—'}
              icon={Users}
              accent="violet"
              hint="Registered wallet holders"
            />
            <StatCard
              label="Wallet float"
              value={data ? formatTZS(data.summary.totalBalance) : '—'}
              icon={Wallet}
              accent="emerald"
              hint="Held across all student wallets"
            />
            <StatCard
              label="Average balance"
              value={data ? formatTZS(data.summary.averageBalance) : '—'}
              icon={WalletCards}
              accent="sky"
              hint="Per student"
            />
          </div>

          <SectionCard contentClassName="space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <SearchField
                value={search}
                onChange={setSearch}
                placeholder="Name, student number, phone or course…"
                ariaLabel="Search students"
              />
              <Badge variant="outline">
                {data ? `${data.total} matching students` : 'Searching…'}
              </Badge>
            </div>

            {data && data.students.length > 0 ? (
              <div className="overflow-x-auto rounded-xl border border-slate-200">
                <Table className="min-w-[820px]">
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead>Student</TableHead>
                      <TableHead>Course</TableHead>
                      <TableHead>Phone</TableHead>
                      <TableHead className="text-right">Balance</TableHead>
                      <TableHead>Joined</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.students.map((student) => (
                      <TableRow key={student.id}>
                        <TableCell>
                          <div className="flex items-center gap-2.5">
                            <Avatar name={student.name} size="sm" />
                            <div className="min-w-0">
                              <p className="truncate text-xs font-semibold text-slate-800">
                                {student.name}
                              </p>
                              <p className="truncate font-mono text-[10px] text-slate-400">
                                {student.studentId}
                              </p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <p className="text-xs text-slate-700">{student.course}</p>
                          <p className="text-[10px] text-slate-400">Year {student.year}</p>
                        </TableCell>
                        <TableCell>
                          <span className="font-mono text-[11px] text-slate-600">
                            {student.phone}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          <Money amount={student.balance} className="text-xs" />
                        </TableCell>
                        <TableCell>
                          <span className="text-[11px] text-slate-500">
                            {formatDate(student.joinedAt)}
                          </span>
                        </TableCell>
                        <TableCell>
                          <div className="flex justify-end gap-1.5">
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              onClick={() => setDetailId(student.id)}
                            >
                              <Eye className="h-3.5 w-3.5" />
                              View
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() => openAdjust(student)}
                            >
                              <Wallet className="h-3.5 w-3.5" />
                              Adjust
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <TableEmpty
                icon={search ? SearchX : Users}
                title={search ? 'No students match that search' : 'No students enrolled yet'}
                description={
                  search
                    ? 'Try the student number, full name or a phone fragment.'
                    : 'Students appear here after their first OTP login with this university.'
                }
                action={
                  search ? (
                    <Button type="button" variant="outline" size="sm" onClick={() => setSearch('')}>
                      Clear search
                    </Button>
                  ) : undefined
                }
              />
            )}

            {data ? (
              <Pagination
                page={data.page}
                pageSize={data.pageSize}
                total={data.total}
                onChange={setPage}
              />
            ) : null}
          </SectionCard>
        </>
      )}

      <StudentDetailDialog
        studentId={detailId}
        open={Boolean(detailId)}
        onOpenChange={(open) => {
          if (!open) setDetailId(null);
        }}
        onAdjust={setAdjustTarget}
      />

      <AdjustWalletDialog
        target={adjustTarget}
        open={Boolean(adjustTarget)}
        onOpenChange={(open) => {
          if (!open) setAdjustTarget(null);
        }}
        onDone={reload}
      />
    </div>
  );
}
