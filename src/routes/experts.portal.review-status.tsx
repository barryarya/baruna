import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ListTree,
  Clock,
  RotateCcw,
  FileEdit,
  CheckCircle2,
  AlertCircle,
  FileText,
  Paperclip,
  ExternalLink,
} from "lucide-react";
import { toast } from "sonner";
import { PageShell } from "@/components/baruna/page/PageShell";
import { trainerPortalNav, EXPERTS_SIDEBAR_META } from "@/data/expertsNav";
import { useTrainerPortal } from "@/lib/experts/useTrainerPortal";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/experts/portal/review-status")({
  head: () => ({
    meta: [{ title: "Module Review Status — Trainer Portal" }],
  }),
  component: ReviewStatusPage,
});

function formatBytes(bytes: number) {
  if (!bytes || bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

type ModuleAttachedFile = {
  type: string;
  name: string;
  size: number;
  path?: string;
};

function getDraftFiles(payloadRaw: unknown): ModuleAttachedFile[] {
  const payload = (payloadRaw as Record<string, unknown>) ?? {};
  const metadata = (payload.metadata as Record<string, unknown>) ?? {};

  const rawList = Array.isArray(metadata.attached_resources)
    ? (metadata.attached_resources as Array<Record<string, unknown>>)
    : Array.isArray(payload.documents)
      ? (payload.documents as Array<Record<string, unknown>>)
      : Array.isArray(payload.attached_resources)
        ? (payload.attached_resources as Array<Record<string, unknown>>)
        : [];

  return rawList.map((doc) => ({
    type: String(doc.type || doc.category || "Dokumen Pendukung"),
    name: String(doc.fileName || doc.name || "Berkas"),
    size: Number(doc.fileSize || doc.size || 0),
    path: typeof doc.path === "string" ? doc.path : undefined,
  }));
}

function ReviewStatusPage() {
  const q = useTrainerPortal();
  const drafts = q.data?.moduleDrafts ?? [];

  const handleOpenFile = async (filePath?: string) => {
    if (!filePath) {
      toast.info("Berkas tersimpan sebagai metadata draf pengajuan.");
      return;
    }
    try {
      const { data, error } = await supabase.storage
        .from("expert-applications")
        .createSignedUrl(filePath, 3600);
      if (error || !data?.signedUrl) {
        toast.error("Gagal mendapatkan akses berkas.");
        return;
      }
      window.open(data.signedUrl, "_blank", "noopener,noreferrer");
    } catch {
      toast.error("Tidak dapat membuka berkas.");
    }
  };

  return (
    <PageShell
      sidebar={{
        ...EXPERTS_SIDEBAR_META,
        title: "Trainer Portal",
        subtitle: "Module review pipeline.",
        sections: trainerPortalNav("/experts/portal/review-status"),
      }}
      cta={{
        icon: ListTree,
        title: "Transparent review history",
        description: "Decisions and reviewer comments come directly from governance records.",
        button: "Back to Dashboard",
        href: "/experts/portal",
      }}
    >
      <div className="space-y-6">
        <div>
          <h1 className="font-display text-3xl font-extrabold text-navy">Module Review Status</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Lacak setiap pengajuan modul pelatihan, periksa kelengkapan berkas dokumen, dan pantau
            umpan balik verifikator BARUNA.
          </p>
        </div>

        {q.isLoading ? (
          <p className="text-sm text-muted-foreground">Loading module reviews…</p>
        ) : drafts.length ? (
          <div className="space-y-5">
            {drafts.map((d) => {
              const latestDecision = d.reviewHistory?.[0];
              const isRevision =
                d.reviewStatus === "revision_requested" ||
                latestDecision?.decision === "return_for_revision";
              const isApproved =
                d.reviewStatus === "approved" || latestDecision?.decision === "approve";
              const isRejected =
                d.reviewStatus === "rejected" || latestDecision?.decision === "reject";
              const files = getDraftFiles(d.payload);

              return (
                <section
                  key={d.id}
                  className={`rounded-2xl border p-6 shadow-soft transition ${
                    isRevision
                      ? "border-amber-300 bg-amber-50/30"
                      : isApproved
                        ? "border-emerald-200 bg-card"
                        : "border-border bg-card"
                  }`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <p className="text-xs font-bold uppercase text-muted-foreground">
                        Modul Pelatihan
                      </p>
                      <h2 className="mt-1 font-display text-xl font-bold text-navy">{d.title}</h2>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Diperbarui: {new Date(d.updatedAt).toLocaleDateString("id-ID")}
                      </p>
                    </div>

                    <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                      {isRevision ? (
                        <Badge className="bg-amber-100 text-amber-800 border-amber-300 flex items-center gap-1 font-medium">
                          <RotateCcw className="h-3 w-3" /> Perlu Revisi
                        </Badge>
                      ) : isApproved ? (
                        <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 flex items-center gap-1 font-medium">
                          <CheckCircle2 className="h-3 w-3" /> Disetujui
                        </Badge>
                      ) : isRejected ? (
                        <Badge className="bg-rose-100 text-rose-800 border-rose-300 flex items-center gap-1 font-medium">
                          <AlertCircle className="h-3 w-3" /> Ditolak
                        </Badge>
                      ) : (
                        <Badge className="bg-blue-100 text-blue-800 border-blue-200 flex items-center gap-1 font-medium">
                          <Clock className="h-3 w-3" /> Sedang Direview
                        </Badge>
                      )}

                      {isRevision && (
                        <Link
                          to="/experts/portal/submit-module"
                          search={{ draftId: d.id }}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-amber-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-amber-700 transition"
                        >
                          <FileEdit className="h-3.5 w-3.5" /> Perbaiki &amp; Unggah Ulang Berkas
                        </Link>
                      )}
                    </div>
                  </div>

                  {/* Catatan evaluasi verifikator */}
                  {isRevision && latestDecision?.comment && (
                    <div className="mt-4 rounded-xl border border-amber-200 bg-white/90 p-4 text-xs text-slate-800">
                      <span className="font-bold text-amber-800 uppercase tracking-wide block mb-1">
                        Catatan Evaluasi Verifikator:
                      </span>
                      <p className="italic text-slate-700 leading-relaxed">
                        &quot;{latestDecision.comment}&quot;
                      </p>
                    </div>
                  )}

                  {/* BERKAS LAMPIRAN MODUL */}
                  <div className="mt-5 pt-4 border-t border-border/70">
                    <span className="text-xs font-bold text-navy uppercase tracking-wider flex items-center gap-1.5 mb-2.5">
                      <Paperclip className="h-3.5 w-3.5 text-marine" />
                      Berkas Lampiran Modul ({files.length} Dokumen)
                    </span>

                    {files.length === 0 ? (
                      <div className="rounded-xl border border-dashed border-border p-3 text-center text-xs text-muted-foreground">
                        Belum ada dokumen yang diunggah pada pengajuan ini.
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                        {files.map((file, fIdx) => (
                          <div
                            key={fIdx}
                            className="flex items-center justify-between gap-2 rounded-xl border border-border bg-white p-3 shadow-2xs hover:border-marine/40 transition"
                          >
                            <div className="flex items-center gap-2 min-w-0 flex-1">
                              <FileText className="h-4 w-4 shrink-0 text-marine" />
                              <div className="min-w-0 flex-1">
                                <p className="text-[11px] font-bold text-navy truncate">
                                  {file.type}
                                </p>
                                <p className="text-[10px] text-muted-foreground truncate">
                                  {file.name} {file.size > 0 ? `(${formatBytes(file.size)})` : ""}
                                </p>
                              </div>
                            </div>

                            {file.path ? (
                              <button
                                type="button"
                                onClick={() => handleOpenFile(file.path)}
                                title="Buka / Unduh Dokumen"
                                className="inline-flex items-center gap-1 rounded-md bg-marine/10 px-2 py-1 text-[10px] font-bold text-marine hover:bg-marine hover:text-white transition cursor-pointer"
                              >
                                <ExternalLink className="h-3 w-3" /> Buka
                              </button>
                            ) : (
                              <span className="inline-block rounded bg-slate-100 px-1.5 py-0.5 text-[9px] font-medium text-slate-600">
                                Tersimpan
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <h3 className="mt-5 font-display text-sm font-bold text-navy">
                    Riwayat Keputusan Verifikasi
                  </h3>
                  {d.reviewHistory.length ? (
                    <ul className="mt-2 divide-y divide-border">
                      {d.reviewHistory.map((h, i) => (
                        <li key={`${h.at}-${i}`} className="py-3">
                          <div className="flex justify-between gap-2">
                            <b className="text-sm text-navy">{h.actor}</b>
                            <span className="text-xs text-muted-foreground">
                              {new Date(h.at).toLocaleString("id-ID")}
                            </span>
                          </div>
                          <p className="mt-1 text-xs font-semibold capitalize text-marine">
                            {h.decision.replaceAll("_", " ")}
                          </p>
                          {h.comment && (
                            <p className="mt-1 text-sm text-foreground/75">&quot;{h.comment}&quot;</p>
                          )}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-2 flex items-center gap-2 rounded-lg bg-muted p-3 text-xs text-muted-foreground">
                      <Clock className="h-4 w-4" /> Belum ada keputusan verifikator yang dicatat.
                    </p>
                  )}
                </section>
              );
            })}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-border bg-card p-12 text-center">
            <ListTree className="mx-auto h-8 w-8 text-marine" />
            <p className="mt-3 font-display text-lg font-bold text-navy">
              Belum ada pengajuan modul
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Draf yang tersimpan dan modul yang telah diajukan akan ditampilkan di sini.
            </p>
          </div>
        )}
      </div>
    </PageShell>
  );
}
