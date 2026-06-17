"use client";

import StatusCard, { type StatusReportItem } from "./StatusCard";

type StatusListProps = {
  reports: StatusReportItem[];
  deletingReportId?: number | null;
  onEdit?: (reportId: number) => void;
  onDelete?: (reportId: number) => void;
};

export default function StatusList({
  reports,
  deletingReportId,
  onEdit,
  onDelete,
}: StatusListProps) {
  if (reports.length === 0) {
    return (
      <div className="rounded-[28px] border border-dashed border-slate-300 bg-white/90 p-10 text-center text-slate-600 shadow-sm">
        Kamu belum memiliki laporan yang dikirim.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {reports.map((report) => (
        <StatusCard
          key={report.id}
          report={report}
          onEdit={onEdit}
          onDelete={onDelete}
          deleting={deletingReportId === report.id}
        />
      ))}
    </div>
  );
}
