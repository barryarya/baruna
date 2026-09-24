import { useState, useMemo } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Award,
  CheckCircle2,
  Clock,
  Download,
  ExternalLink,
  Eye,
  FileCheck2,
  FileText,
  Filter,
  GraduationCap,
  Globe,
  Mail,
  Phone,
  RefreshCw,
  RotateCcw,
  Search,
  ShieldAlert,
  ShieldCheck,
  UserCheck,
  XCircle,
  AlertCircle,
} from "lucide-react";
import { toast } from "sonner";
import { DocumentViewerModal } from "@/components/baruna/DocumentViewerModal";
import { triggerFileDownload } from "@/lib/storage/mime";
import {
  listAdminExpertApplications,
  getAdminExpertDetail,
  recordAdminExpertDecision,
  type AdminExpertItem,
  type AdminExpertDetail,
} from "@/lib/admin/experts.functions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/admin/experts")({
  head: () => ({
    meta: [
      { title: "Verifikasi Expert — BARUNA Administration" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: AdminExpertsPage,
});

function formatDate(dateStr: string) {
  if (!dateStr) return "—";
  try {
    return new Intl.DateTimeFormat("id-ID", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(dateStr));
  } catch {
    return dateStr;
  }
}

function formatBytes(bytes: number) {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

function getStatusBadge(status: string) {
  switch (status) {
    case "approved":
      return (
        <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200 hover:bg-emerald-100 flex items-center gap-1 font-medium">
          <CheckCircle2 className="h-3 w-3" /> Disetujui (Aktif)
        </Badge>
      );
    case "resubmitted":
      return (
        <Badge className="bg-sky-100 text-sky-900 border-sky-300 hover:bg-sky-100 flex items-center gap-1 font-semibold shadow-2xs">
          <RotateCcw className="h-3 w-3 text-sky-600 animate-spin" style={{ animationDuration: "3s" }} /> Sudah Direvisi
        </Badge>
      );
    case "revision_requested":
      return (
        <Badge className="bg-amber-100 text-amber-800 border-amber-200 hover:bg-amber-100 flex items-center gap-1 font-medium">
          <RotateCcw className="h-3 w-3" /> Perlu Revisi
        </Badge>
      );
    case "rejected":
      return (
        <Badge className="bg-rose-100 text-rose-800 border-rose-200 hover:bg-rose-100 flex items-center gap-1 font-medium">
          <XCircle className="h-3 w-3" /> Ditolak
        </Badge>
      );
    case "under_review":
      return (
        <Badge className="bg-blue-100 text-blue-800 border-blue-200 hover:bg-blue-100 flex items-center gap-1 font-medium">
          <Clock className="h-3 w-3" /> Sedang Direview
        </Badge>
      );
    case "decision_pending":
    case "pending":
    default:
      return (
        <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200 hover:bg-yellow-100 flex items-center gap-1 font-medium">
          <Clock className="h-3 w-3" /> Menunggu Verifikasi
        </Badge>
      );
  }
}

function AdminExpertsPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedSubjectId, setSelectedSubjectId] = useState<string | null>(null);

  const listFn = useServerFn(listAdminExpertApplications);
  const detailFn = useServerFn(getAdminExpertDetail);
  const decisionFn = useServerFn(recordAdminExpertDecision);

  const {
    data: applications = [],
    isLoading,
    isRefetching,
    refetch,
  } = useQuery({
    queryKey: ["admin", "experts", statusFilter, search],
    queryFn: () => listFn({ data: { status: statusFilter, search } }),
  });

  // Calculate statistics
  const stats = useMemo(() => {
    let total = applications.length;
    let pending = 0;
    let resubmitted = 0;
    let revision = 0;
    let approved = 0;

    applications.forEach((item) => {
      if (
        item.status === "pending" ||
        item.status === "under_review" ||
        item.status === "decision_pending"
      ) {
        pending++;
      } else if (item.status === "resubmitted") {
        pending++;
        resubmitted++;
      } else if (item.status === "revision_requested") {
        revision++;
      } else if (item.status === "approved") {
        approved++;
      }
    });

    return { total, pending, resubmitted, revision, approved };
  }, [applications]);

  // Selected candidate detail query
  const { data: activeDetail, isLoading: isDetailLoading } = useQuery({
    queryKey: ["admin", "expert-detail", selectedSubjectId],
    queryFn: () => (selectedSubjectId ? detailFn({ data: { subjectId: selectedSubjectId } }) : null),
    enabled: Boolean(selectedSubjectId),
  });

  return (
    <div className="space-y-8">
      {/* Top Header */}
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-marine/10 text-marine">
              <UserCheck className="h-5 w-5" />
            </span>
            <h1 className="font-display text-2xl font-bold text-navy">
              Verifikasi & Tata Kelola Expert
            </h1>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Berdasarkan Panduan Proses Bisnis BARUNA (PB-EXP-01 & PB-EXP-02). Kelola verifikasi berkas,
            keahlian, dan persetujuan narasumber kelautan dan perikanan.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isLoading || isRefetching}
            className="flex items-center gap-1.5"
          >
            <RefreshCw className={`h-4 w-4 ${isRefetching ? "animate-spin" : ""}`} />
            Segarkan Data
          </Button>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-border bg-white p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Total Pengajuan
            </span>
            <span className="rounded-lg bg-slate-100 p-2 text-slate-700">
              <Award className="h-4 w-4" />
            </span>
          </div>
          <p className="mt-3 text-2xl font-bold text-navy">{stats.total}</p>
          <span className="text-xs text-muted-foreground">Seluruh permohonan tercatat</span>
        </div>

        <div className="rounded-xl border border-border bg-white p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-yellow-700">
              Menunggu Verifikasi
            </span>
            <span className="rounded-lg bg-yellow-50 p-2 text-yellow-600">
              <Clock className="h-4 w-4" />
            </span>
          </div>
          <div className="flex items-baseline gap-2 mt-3">
            <p className="text-2xl font-bold text-yellow-700">{stats.pending}</p>
            {stats.resubmitted > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-bold text-sky-800 border border-sky-200">
                <RotateCcw className="h-2.5 w-2.5" /> {stats.resubmitted} Sudah Direvisi
              </span>
            )}
          </div>
          <span className="text-xs text-muted-foreground">Perlu pemeriksaan berkas & substansi</span>
        </div>

        <div className="rounded-xl border border-border bg-white p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-amber-700">
              Perlu Revisi
            </span>
            <span className="rounded-lg bg-amber-50 p-2 text-amber-600">
              <RotateCcw className="h-4 w-4" />
            </span>
          </div>
          <p className="mt-3 text-2xl font-bold text-amber-700">{stats.revision}</p>
          <span className="text-xs text-muted-foreground">Menunggu perbaikan dari pemohon</span>
        </div>

        <div className="rounded-xl border border-border bg-white p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-emerald-700">
              Disetujui & Aktif
            </span>
            <span className="rounded-lg bg-emerald-50 p-2 text-emerald-600">
              <CheckCircle2 className="h-4 w-4" />
            </span>
          </div>
          <p className="mt-3 text-2xl font-bold text-emerald-700">{stats.approved}</p>
          <span className="text-xs text-muted-foreground">Tayang di Direktori Publik</span>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="rounded-xl border border-border bg-white p-4 shadow-xs">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Cari nama kandidat, institusi, email, atau bidang keahlian..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-lg border border-border bg-slate-50/50 py-2 pl-9 pr-4 text-sm text-foreground outline-none transition focus:border-marine focus:bg-white focus:ring-1 focus:ring-marine"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="flex items-center gap-1 text-xs font-medium text-muted-foreground">
              <Filter className="h-3.5 w-3.5" /> Status:
            </span>
            {[
              { id: "all", label: "Semua" },
              { id: "pending", label: "Menunggu" },
              { id: "resubmitted", label: "Sudah Direvisi" },
              { id: "revision_requested", label: "Perlu Revisi" },
              { id: "approved", label: "Disetujui" },
              { id: "rejected", label: "Ditolak" },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setStatusFilter(tab.id)}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                  statusFilter === tab.id
                    ? "bg-navy text-white shadow-xs"
                    : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Table of Applications */}
      <div className="overflow-hidden rounded-xl border border-border bg-white shadow-xs">
        {isLoading ? (
          <div className="p-12 text-center text-sm text-muted-foreground">
            <RefreshCw className="mx-auto h-6 w-6 animate-spin text-marine" />
            <p className="mt-3">Memuat data permohonan expert...</p>
          </div>
        ) : applications.length === 0 ? (
          <div className="p-12 text-center">
            <FileText className="mx-auto h-10 w-10 text-muted-foreground/60" />
            <h3 className="mt-3 font-display text-base font-bold text-navy">
              Tidak Ada Pengajuan Ditemukan
            </h3>
            <p className="mt-1 text-xs text-muted-foreground">
              {search || statusFilter !== "all"
                ? "Cobalah mengubah kata kunci pencarian atau filter status."
                : "Belum ada pendaftaran calon expert yang masuk ke sistem."}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-border bg-slate-50/70 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                <tr>
                  <th className="px-6 py-4">Kandidat / Pelamar</th>
                  <th className="px-6 py-4">Institusi & Kontak</th>
                  <th className="px-6 py-4">Kepakaran & Peran</th>
                  <th className="px-6 py-4 text-center">Dokumen</th>
                  <th className="px-6 py-4">Tanggal Daftar</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {applications.map((item) => (
                  <tr key={item.subjectId} className="hover:bg-slate-50/60 transition">
                    <td className="px-6 py-4">
                      <div className="font-semibold text-navy">{item.applicantName}</div>
                      {item.jobTitle && (
                        <div className="text-xs text-muted-foreground">{item.jobTitle}</div>
                      )}
                    </td>

                    <td className="px-6 py-4">
                      <div className="text-foreground">{item.institution || "—"}</div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                        {item.email && (
                          <span className="flex items-center gap-1">
                            <Mail className="h-3 w-3" /> {item.email}
                          </span>
                        )}
                        {item.country && <span>{item.country}</span>}
                      </div>
                    </td>

                    <td className="px-6 py-4">
                      <div className="flex flex-wrap gap-1 max-w-xs">
                        {item.expertise.slice(0, 2).map((exp, idx) => (
                          <span
                            key={idx}
                            className="inline-block rounded bg-marine/10 px-2 py-0.5 text-[11px] font-medium text-marine"
                          >
                            {exp}
                          </span>
                        ))}
                        {item.expertise.length > 2 && (
                          <span className="text-[11px] text-muted-foreground">
                            +{item.expertise.length - 2}
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-muted-foreground mt-1">
                        Peran: {item.roles.join(", ") || "Trainer"}
                      </div>
                    </td>

                    <td className="px-6 py-4 text-center">
                      <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-700">
                        <FileCheck2 className="h-3.5 w-3.5 text-marine" />
                        {item.documentsCount} Berkas
                      </span>
                    </td>

                    <td className="px-6 py-4 text-xs text-muted-foreground">
                      {formatDate(item.createdAt)}
                    </td>

                    <td className="px-6 py-4">
                      <div className="flex flex-col gap-1 items-start">
                        {getStatusBadge(item.status)}
                        {item.status === "resubmitted" && (
                          <span className="text-[11px] font-medium text-sky-700">
                            Revisi dikirim {formatDate(item.resubmittedAt || item.updatedAt)}
                          </span>
                        )}
                        {item.publishedSlug && (
                          <a
                            href={`/experts/${item.publishedSlug}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-[11px] font-semibold text-marine hover:underline mt-0.5"
                          >
                            <ExternalLink className="h-3 w-3" /> Tayang di Direktori
                          </a>
                        )}
                      </div>
                    </td>

                    <td className="px-6 py-4 text-right">
                      <Button
                        size="sm"
                        variant="default"
                        className="bg-navy hover:bg-navy/90 text-white text-xs font-semibold"
                        onClick={() => setSelectedSubjectId(item.subjectId)}
                      >
                        Periksa & Verifikasi
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Verification Detail Dialog */}
      {selectedSubjectId && (
        <ExpertDetailModal
          subjectId={selectedSubjectId}
          detail={activeDetail}
          isLoading={isDetailLoading}
          onClose={() => setSelectedSubjectId(null)}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ["admin", "experts"] });
            queryClient.invalidateQueries({
              queryKey: ["admin", "expert-detail", selectedSubjectId],
            });
            setSelectedSubjectId(null);
          }}
          decisionFn={decisionFn}
        />
      )}
    </div>
  );
}

// Modal Component for Viewing Details and Performing Verification
function ExpertDetailModal({
  subjectId,
  detail,
  isLoading,
  onClose,
  onSuccess,
  decisionFn,
}: {
  subjectId: string;
  detail?: AdminExpertDetail | null;
  isLoading: boolean;
  onClose: () => void;
  onSuccess: () => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  decisionFn: any;
}) {
  const [rationale, setRationale] = useState("");
  const [rationaleError, setRationaleError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("profile");
  const [submitting, setSubmitting] = useState(false);
  const [previewDoc, setPreviewDoc] = useState<{
    url: string;
    name: string;
    category?: string;
  } | null>(null);

  const handleDecision = async (decision: "approve" | "return_for_revision" | "reject") => {
    setRationaleError(null);
    if ((decision === "return_for_revision" || decision === "reject") && !rationale.trim()) {
      const errMsg = "Wajib mengisi catatan evaluasi/alasan revisi agar calon expert mengetahui bagian yang perlu diperbaiki.";
      setRationaleError(errMsg);
      toast.error(errMsg);
      return;
    }

    const confirmMsg =
      decision === "approve"
        ? "Apakah Anda yakin ingin MENYETUJUI calon expert ini? Profil akan otomatis dipublikasikan ke Direktori Publik dan hak akses role expert akan diberikan."
        : decision === "return_for_revision"
          ? "Kembalikan berkas ini ke pemohon untuk perbaikan/revisi?"
          : "Apakah Anda yakin ingin MENOLAK pengajuan calon expert ini?";

    if (!window.confirm(confirmMsg)) return;

    try {
      setSubmitting(true);
      await decisionFn({
        data: {
          subjectId,
          decision,
          rationale: rationale.trim(),
        },
      });

      const label =
        decision === "approve"
          ? "Pengajuan disetujui & profil dipublikasikan!"
          : decision === "return_for_revision"
            ? "Permintaan revisi berhasil dikirim ke pendaftar."
            : "Pengajuan telah ditolak.";

      toast.success(label);
      onSuccess();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Gagal memproses keputusan verifikasi.";
      toast.error(msg);
      setRationaleError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader className="border-b border-border pb-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <DialogTitle className="text-xl font-bold text-navy flex items-center gap-2">
                <GraduationCap className="h-5 w-5 text-marine" />
                {isLoading ? "Memuat data kandidat..." : detail?.applicantName}
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                {detail?.jobTitle
                  ? `${detail.jobTitle} • ${detail.institution || "Independen"}`
                  : "Detail Pemeriksaan Calon Expert BARUNA"}
              </DialogDescription>
            </div>
            {detail && <div>{getStatusBadge(detail.status)}</div>}
          </div>
        </DialogHeader>

        {isLoading || !detail ? (
          <div className="py-16 text-center text-sm text-muted-foreground">
            <RefreshCw className="mx-auto h-6 w-6 animate-spin text-marine" />
            <p className="mt-2">Mengambil berkas dan kelengkapan kandidat...</p>
          </div>
        ) : (
          <>
            {detail?.status === "approved" && (
              <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-xs text-emerald-900">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                  <span>
                    <strong>Pengajuan Disetujui:</strong> Profil expert ini telah aktif dan dipublikasikan ke sistem.
                  </span>
                </div>
                {detail.publishedSlug && (
                  <a
                    href={`/experts/${detail.publishedSlug}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-md bg-emerald-600 px-3 py-1 font-semibold text-white hover:bg-emerald-700 transition"
                  >
                    <ExternalLink className="h-3.5 w-3.5" /> Buka Profil Publik
                  </a>
                )}
              </div>
            )}

            {detail?.status === "resubmitted" && (
              <div className="mt-3 rounded-xl border border-sky-300 bg-sky-50/90 p-4 shadow-2xs">
                <div className="flex items-center gap-2 font-bold text-sky-950 text-sm">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-sky-200 text-sky-800">
                    <RotateCcw className="h-3.5 w-3.5" />
                  </span>
                  Pengajuan Calon Expert Ini Sudah Direvisi
                  <Badge variant="outline" className="bg-sky-100 text-sky-800 border-sky-300 text-[10px] ml-auto">
                    Revisi Baru Siap Verifikasi
                  </Badge>
                </div>
                <p className="mt-1.5 text-xs text-sky-900 leading-relaxed">
                  Calon expert telah memperbarui data dan mengunggah berkas perbaikan pada{" "}
                  <strong>{formatDate(detail.resubmittedAt || detail.updatedAt)}</strong>. Silakan periksa perubahan profil dan kelengkapan dokumen sebelum memberikan persetujuan (ACC).
                </p>
                {detail.lastRevisionRationale && (
                  <div className="mt-3 rounded-lg border border-sky-200 bg-white p-3 text-xs">
                    <span className="block font-semibold text-slate-800 text-[11px] uppercase tracking-wider mb-0.5">
                      Catatan Permintaan Revisi Sebelumnya (dari Verifikator):
                    </span>
                    <p className="italic text-slate-700">
                      &quot;{detail.lastRevisionRationale}&quot;
                    </p>
                  </div>
                )}
              </div>
            )}

            <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-3">
            <TabsList className="grid grid-cols-4 bg-slate-100">
              <TabsTrigger value="profile">Biodata Diri</TabsTrigger>
              <TabsTrigger value="expertise">Keahlian & Karir</TabsTrigger>
              <TabsTrigger value="documents">
                Lampiran Dokumen ({detail.documents.length})
              </TabsTrigger>
              <TabsTrigger value="decision" className="font-semibold text-marine">
                Keputusan Verifikasi
              </TabsTrigger>
            </TabsList>

            {/* TAB 1: BIODATA */}
            <TabsContent value="profile" className="mt-5 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="rounded-lg border border-border p-4 bg-slate-50/40">
                  <span className="text-xs font-semibold text-muted-foreground uppercase">
                    Nama Lengkap
                  </span>
                  <p className="text-sm font-semibold text-navy mt-1">{detail.applicantName}</p>
                </div>

                <div className="rounded-lg border border-border p-4 bg-slate-50/40">
                  <span className="text-xs font-semibold text-muted-foreground uppercase">
                    Jabatan / Gelar Profesional
                  </span>
                  <p className="text-sm font-semibold text-navy mt-1">
                    {detail.jobTitle || "Tidak dicantumkan"}
                  </p>
                </div>

                <div className="rounded-lg border border-border p-4 bg-slate-50/40">
                  <span className="text-xs font-semibold text-muted-foreground uppercase">
                    Institusi / Lembaga / Afiliasi
                  </span>
                  <p className="text-sm font-semibold text-navy mt-1">
                    {detail.institution || "Tidak dicantumkan"}
                  </p>
                </div>

                <div className="rounded-lg border border-border p-4 bg-slate-50/40">
                  <span className="text-xs font-semibold text-muted-foreground uppercase">
                    Negara Asal / Wilayah
                  </span>
                  <p className="text-sm font-semibold text-navy mt-1 flex items-center gap-1.5">
                    <Globe className="h-4 w-4 text-marine" />
                    {detail.country || "Indonesia"}
                  </p>
                </div>

                <div className="rounded-lg border border-border p-4 bg-slate-50/40">
                  <span className="text-xs font-semibold text-muted-foreground uppercase">
                    Email Kontak
                  </span>
                  <p className="text-sm font-semibold text-navy mt-1 flex items-center gap-1.5">
                    <Mail className="h-4 w-4 text-marine" />
                    {detail.email || "—"}
                  </p>
                </div>

                <div className="rounded-lg border border-border p-4 bg-slate-50/40">
                  <span className="text-xs font-semibold text-muted-foreground uppercase">
                    Nomor Telepon / WhatsApp
                  </span>
                  <p className="text-sm font-semibold text-navy mt-1 flex items-center gap-1.5">
                    <Phone className="h-4 w-4 text-marine" />
                    {detail.phone || "—"}
                  </p>
                </div>
              </div>

              <div className="rounded-lg border border-border p-4 bg-slate-50/40">
                <span className="text-xs font-semibold text-muted-foreground uppercase">
                  Ringkasan Profil / Biografi Singkat
                </span>
                <p className="text-sm text-foreground mt-2 whitespace-pre-line leading-relaxed">
                  {detail.biography || "Belum ada ringkasan biografi."}
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="rounded-lg border border-border p-4 bg-slate-50/40">
                  <span className="text-xs font-semibold text-muted-foreground uppercase">
                    Pengalaman Kerja (Tahun)
                  </span>
                  <p className="text-sm font-semibold text-navy mt-1">
                    {detail.yearsExperience ? `${detail.yearsExperience} Tahun` : "—"}
                  </p>
                </div>

                <div className="rounded-lg border border-border p-4 bg-slate-50/40">
                  <span className="text-xs font-semibold text-muted-foreground uppercase">
                    Bahasa yang Dikuasai
                  </span>
                  <p className="text-sm font-semibold text-navy mt-1">
                    {detail.languages || "Bahasa Indonesia"}
                  </p>
                </div>
              </div>
            </TabsContent>

            {/* TAB 2: KEPARAKAN & KARIR */}
            <TabsContent value="expertise" className="mt-5 space-y-4">
              <div className="rounded-lg border border-border p-4 bg-slate-50/40">
                <span className="text-xs font-semibold text-muted-foreground uppercase block mb-2">
                  Bidang Keahlian Utama
                </span>
                <div className="flex flex-wrap gap-2">
                  {detail.expertise.length > 0 ? (
                    detail.expertise.map((exp, idx) => (
                      <Badge
                        key={idx}
                        className="bg-marine/10 text-marine border-marine/20 px-3 py-1 text-xs font-medium"
                      >
                        {exp}
                      </Badge>
                    ))
                  ) : (
                    <span className="text-xs text-muted-foreground">
                      Tidak ada bidang keahlian dicantumkan.
                    </span>
                  )}
                </div>
              </div>

              <div className="rounded-lg border border-border p-4 bg-slate-50/40">
                <span className="text-xs font-semibold text-muted-foreground uppercase block mb-2">
                  Peran yang Diminati di BARUNA
                </span>
                <div className="flex flex-wrap gap-2">
                  {detail.roles.length > 0 ? (
                    detail.roles.map((r, idx) => (
                      <Badge
                        key={idx}
                        className="bg-navy/10 text-navy border-navy/20 px-3 py-1 text-xs font-medium"
                      >
                        {r}
                      </Badge>
                    ))
                  ) : (
                    <Badge className="bg-navy/10 text-navy border-navy/20">Trainer</Badge>
                  )}
                </div>
              </div>

              <div className="rounded-lg border border-border p-4 bg-slate-50/40">
                <span className="text-xs font-semibold text-muted-foreground uppercase">
                  Proyek / Pengalaman Utama
                </span>
                <p className="text-sm text-foreground mt-2 whitespace-pre-line leading-relaxed">
                  {detail.keyProjects || "Tidak ada catatan proyek penting."}
                </p>
              </div>

              <div className="rounded-lg border border-border p-4 bg-slate-50/40">
                <span className="text-xs font-semibold text-muted-foreground uppercase">
                  Publikasi Ilmiah / Riset / Buku Terkait
                </span>
                <p className="text-sm text-foreground mt-2 whitespace-pre-line leading-relaxed">
                  {detail.publications || "Tidak ada daftar publikasi."}
                </p>
              </div>
            </TabsContent>

            {/* TAB 3: DOKUMEN & BUKTI PENDUKUNG */}
            <TabsContent value="documents" className="mt-5 space-y-4">
              <div className="rounded-lg border border-blue-200 bg-blue-50/50 p-3.5 text-xs text-blue-900 flex items-start gap-2.5">
                <ShieldCheck className="h-4 w-4 shrink-0 text-blue-600 mt-0.5" />
                <div>
                  <strong>Verifikasi Kelengkapan Bukti (PB-EXP-01):</strong>
                  <p className="mt-0.5 text-blue-800">
                    Periksa keabsahan CV, Sertifikat Kompetensi, atau Portofolio yang diunggah
                    pemohon. Klik tombol buka/unduh untuk memverifikasi keaslian dokumen di tab baru.
                  </p>
                </div>
              </div>

              {detail.documents.length === 0 ? (
                <div className="rounded-xl border border-dashed border-border p-8 text-center">
                  <FileText className="mx-auto h-8 w-8 text-muted-foreground/60" />
                  <p className="mt-2 text-sm text-muted-foreground">
                    Tidak ada lampiran berkas yang diunggah.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                  {detail.documents.map((doc, idx) => (
                    <div
                      key={idx}
                      className="flex flex-col justify-between rounded-xl border border-border bg-white p-4 shadow-2xs hover:border-marine/40 transition"
                    >
                      <div>
                        <div className="flex items-center justify-between gap-2">
                          <span className="inline-block rounded bg-slate-100 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider text-slate-700">
                            {doc.category}
                          </span>
                          <span className="text-[11px] text-muted-foreground">
                            {formatBytes(doc.size)}
                          </span>
                        </div>
                        <h4 className="mt-2 font-medium text-navy text-sm break-all line-clamp-2">
                          {doc.name}
                        </h4>
                        <p className="text-[11px] text-muted-foreground mt-1">
                          Diunggah: {formatDate(doc.uploadedAt)}
                        </p>
                      </div>

                      <div className="mt-4 pt-3 border-t border-border/60 flex items-center gap-2">
                        {doc.downloadUrl ? (
                          <>
                            <a
                              href={`/document-viewer?url=${encodeURIComponent(doc.downloadUrl)}&name=${encodeURIComponent(doc.name)}&category=${encodeURIComponent(doc.category)}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg bg-marine/10 py-2 px-3 text-xs font-semibold text-marine hover:bg-marine hover:text-white transition"
                              title="Buka pratinjau di tab peramban baru"
                            >
                              <ExternalLink className="h-3.5 w-3.5" /> Buka di Tab
                            </a>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() =>
                                setPreviewDoc({
                                  url: doc.downloadUrl!,
                                  name: doc.name,
                                  category: doc.category,
                                })
                              }
                              className="h-8 text-xs font-semibold border-border hover:bg-slate-100 text-navy gap-1"
                              title="Pratinjau cepat di dalam dialog"
                            >
                              <Eye className="h-3.5 w-3.5 text-marine" /> Pratinjau
                            </Button>
                            <Button
                              type="button"
                              size="icon"
                              variant="ghost"
                              onClick={() => triggerFileDownload(doc.downloadUrl!, doc.name)}
                              className="h-8 w-8 text-muted-foreground hover:text-navy hover:bg-slate-100"
                              title="Unduh langsung file asli"
                            >
                              <Download className="h-3.5 w-3.5" />
                            </Button>
                          </>
                        ) : (
                          <span className="text-xs text-muted-foreground italic">
                            Berkas tidak dapat diakses
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>

            {/* TAB 4: KEPUTUSAN VERIFIKASI */}
            <TabsContent value="decision" className="mt-5 space-y-5">
              {detail.decisionsHistory && detail.decisionsHistory.length > 0 && (
                <div className="rounded-xl border border-border bg-slate-50 p-4">
                  <h4 className="text-xs font-bold text-navy uppercase tracking-wider mb-2">
                    Riwayat Keputusan Sebelumnya
                  </h4>
                  <div className="space-y-2">
                    {detail.decisionsHistory.map((hist) => (
                      <div
                        key={hist.id}
                        className="rounded-lg border border-border bg-white p-3 text-xs"
                      >
                        <div className="flex items-center justify-between font-semibold">
                          <span className="capitalize">{hist.decision.replace(/_/g, " ")}</span>
                          <span className="text-muted-foreground">
                            {formatDate(hist.createdAt)}
                          </span>
                        </div>
                        {hist.rationale && (
                          <p className="mt-1 text-slate-600 italic">
                            &quot;{hist.rationale}&quot;
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="rounded-xl border border-border bg-white p-5 space-y-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-navy mb-1.5">
                    Catatan Evaluasi / Pertimbangan Admin (Rationale)
                  </label>
                  <p className="text-xs text-muted-foreground mb-2">
                    Tuliskan catatan kelayakan, hasil verifikasi keahlian, atau rincian dokumen yang
                    harus diperbaiki jika meminta revisi.
                  </p>
                  <Textarea
                    rows={4}
                    placeholder="Contoh: Berkas CV dan sertifikat keahlian telah diverifikasi lengkap dan valid untuk bidang Budidaya Perikanan..."
                    value={rationale}
                    onChange={(e) => {
                      setRationale(e.target.value);
                      if (rationaleError) setRationaleError(null);
                    }}
                    className={`w-full text-sm ${rationaleError ? "border-destructive ring-1 ring-destructive" : ""}`}
                  />
                  {rationaleError && (
                    <p className="mt-1.5 text-xs font-semibold text-destructive flex items-center gap-1">
                      <AlertCircle className="h-3.5 w-3.5 shrink-0" /> {rationaleError}
                    </p>
                  )}
                </div>

                <div className="pt-3 border-t border-border flex flex-col sm:flex-row items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={onClose}
                      disabled={submitting}
                      className="text-xs"
                    >
                      Batal
                    </Button>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      disabled={submitting}
                      onClick={() => handleDecision("reject")}
                      className="text-xs border-rose-300 text-rose-700 hover:bg-rose-50 flex items-center gap-1.5"
                    >
                      <XCircle className="h-4 w-4" /> Tolak Pengajuan
                    </Button>

                    <Button
                      type="button"
                      variant="outline"
                      disabled={submitting}
                      onClick={() => handleDecision("return_for_revision")}
                      className="text-xs border-amber-300 text-amber-700 hover:bg-amber-50 flex items-center gap-1.5"
                    >
                      <RotateCcw className={`h-4 w-4 ${submitting ? "animate-spin" : ""}`} />
                      {submitting ? "Memproses..." : "Minta Revisi"}
                    </Button>

                    <Button
                      type="button"
                      disabled={submitting}
                      onClick={() => handleDecision("approve")}
                      className="text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-semibold flex items-center gap-1.5 shadow-sm"
                    >
                      <CheckCircle2 className={`h-4 w-4 ${submitting ? "animate-spin" : ""}`} />
                      {submitting
                        ? "Memproses..."
                        : detail?.status === "approved"
                          ? "Sinkronkan / Perbarui Publikasi"
                          : "Setujui & Publikasikan Expert"}
                    </Button>
                  </div>
                </div>
              </div>
            </TabsContent>
          </Tabs>
          </>
        )}
        {previewDoc && (
          <DocumentViewerModal
            url={previewDoc.url}
            name={previewDoc.name}
            category={previewDoc.category}
            isOpen={Boolean(previewDoc)}
            onClose={() => setPreviewDoc(null)}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

