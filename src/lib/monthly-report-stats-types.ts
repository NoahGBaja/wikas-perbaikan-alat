import type { ReportStatus } from "@/lib/report-helpers";

export type MonthlyStatsResponse = {
  month: string;
  monthNumber: number;
  year: number;
  selectedStatus: ReportStatus | "SEMUA";
  summary: {
    totalReports: number;
    totalUniqueReporters: number;
    totalWaiting: number;
    totalApproved: number;
    totalRejected: number;
    totalReopened: number;
    totalOngoing: number;
    totalProcessed: number;
    totalFinished: number;
    totalExpenses: number;
    averageCompletionDays: number;
  };
  categories: {
    items: Array<{
      key: string;
      label: string;
      total: number;
    }>;
  };
  statusBreakdown: Array<{
    key: string;
    label: string;
    total: number;
  }>;
  topReporter: {
    userId: number;
    nama: string;
    nip: string | null;
    totalReports: number;
    lastStatus: ReportStatus;
    topCategory: string;
    latestReportAt: string;
  } | null;
  reporterStats: Array<{
    userId: number;
    nama: string;
    nip: string | null;
    totalReports: number;
    lastStatus: ReportStatus;
    topCategory: string;
    latestReportAt: string;
  }>;
};
