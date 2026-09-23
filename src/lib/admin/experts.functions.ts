import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { ExpertApplicationDocument, ExpertDraftPayload } from "@/lib/experts/application.types";

const DecisionType = z.enum(["approve", "return_for_revision", "reject"]);

export type AdminExpertDocument = ExpertApplicationDocument & {
  downloadUrl: string | null;
};

export type AdminExpertItem = {
  subjectId: string;
  draftId: string | null;
  submitterId: string | null;
  applicantName: string;
  email: string | null;
  phone: string | null;
  institution: string | null;
  country: string | null;
  jobTitle: string | null;
  roles: string[];
  expertise: string[];
  status: string; // pending, under_review, decision_pending, approved, rejected, revision_requested
  createdAt: string;
  updatedAt: string;
  documentsCount: number;
};

export type AdminExpertDetail = AdminExpertItem & {
  biography: string | null;
  languages: string | null;
  yearsExperience: string | null;
  publications: string | null;
  keyProjects: string | null;
  documents: AdminExpertDocument[];
  decisionsHistory: Array<{
    id: string;
    decision: string;
    rationale: string | null;
    decidedBy: string | null;
    createdAt: string;
  }>;
};

async function assertAdminOrReviewer(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  context: { supabase: any; userId: string },
) {
  const roles = ["super_admin", "admin", "management", "qa_reviewer", "verifier", "approver"];
  for (const role of roles) {
    const { data } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: role,
    });
    if (data) return true;
  }
  return false;
}

export const listAdminExpertApplications = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        status: z.string().optional(),
        search: z.string().trim().max(120).default(""),
      })
      .parse(input ?? {}),
  )
  .handler(async ({ data: input, context }): Promise<AdminExpertItem[]> => {
    if (!(await assertAdminOrReviewer(context))) {
      throw new Error("forbidden");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Fetch subjects of kind 'expert'
    let query = supabaseAdmin
      .from("review_subjects")
      .select("id, title, current_status, submitted_by, created_at, updated_at")
      .eq("kind", "expert")
      .order("created_at", { ascending: false });

    if (input.status && input.status !== "all") {
      if (input.status === "pending") {
        query = query.in("current_status", ["pending", "under_review", "decision_pending"]);
      } else {
        query = query.eq("current_status", input.status);
      }
    }

    const { data: subjects, error: subjErr } = await query;
    if (subjErr) throw new Error(subjErr.message);
    if (!subjects || subjects.length === 0) return [];

    const subjectIds = subjects.map((s) => s.id);

    // Fetch linked review_drafts
    const { data: drafts } = await supabaseAdmin
      .from("review_drafts")
      .select("id, linked_subject_id, payload")
      .in("linked_subject_id", subjectIds);

    const draftMap = new Map<string, { id: string; payload: ExpertDraftPayload }>();
    (drafts ?? []).forEach((d) => {
      if (d.linked_subject_id) {
        draftMap.set(d.linked_subject_id, {
          id: d.id,
          payload: (d.payload as unknown as ExpertDraftPayload) ?? {},
        });
      }
    });

    const items: AdminExpertItem[] = subjects.map((subj) => {
      const draft = draftMap.get(subj.id);
      const payload = draft?.payload;
      const rawPayload = (payload ?? {}) as Record<string, unknown>;

      const applicantName =
        (typeof rawPayload.fullName === "string" && rawPayload.fullName) ||
        (typeof rawPayload.display_name === "string" && rawPayload.display_name) ||
        subj.title ||
        "Nama Tidak Tertera";
      const email = payload?.email ?? null;
      const phone = payload?.phone ?? null;
      const institution = payload?.institution ?? null;
      const country = payload?.country ?? null;
      const jobTitle = payload?.title ?? null;
      const roles = Array.isArray(payload?.roles) ? (payload.roles as string[]) : [];
      const expertise = Array.isArray(payload?.expertise) ? (payload.expertise as string[]) : [];
      const documentsCount = Array.isArray(payload?.documents) ? payload.documents.length : 0;

      return {
        subjectId: subj.id,
        draftId: draft?.id ?? null,
        submitterId: subj.submitted_by,
        applicantName,
        email,
        phone,
        institution,
        country,
        jobTitle,
        roles,
        expertise,
        status: subj.current_status,
        createdAt: subj.created_at,
        updatedAt: subj.updated_at,
        documentsCount,
      };
    });

    if (input.search) {
      const q = input.search.toLowerCase();
      return items.filter(
        (it) =>
          it.applicantName.toLowerCase().includes(q) ||
          (it.email && it.email.toLowerCase().includes(q)) ||
          (it.institution && it.institution.toLowerCase().includes(q)) ||
          it.expertise.some((e) => e.toLowerCase().includes(q)),
      );
    }

    return items;
  });

export const getAdminExpertDetail = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ subjectId: z.string().uuid() }).parse(input))
  .handler(async ({ data: input, context }): Promise<AdminExpertDetail | null> => {
    if (!(await assertAdminOrReviewer(context))) {
      throw new Error("forbidden");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: subj, error: subjErr } = await supabaseAdmin
      .from("review_subjects")
      .select("id, title, current_status, submitted_by, created_at, updated_at")
      .eq("id", input.subjectId)
      .eq("kind", "expert")
      .maybeSingle();

    if (subjErr) throw new Error(subjErr.message);
    if (!subj) return null;

    const { data: draft } = await supabaseAdmin
      .from("review_drafts")
      .select("id, payload")
      .eq("linked_subject_id", subj.id)
      .maybeSingle();

    const payload = (draft?.payload as unknown as ExpertDraftPayload) ?? {};

    // Generate signed URLs for all documents attached
    const rawDocuments = Array.isArray(payload?.documents) ? payload.documents : [];
    const documentsWithUrls: AdminExpertDocument[] = await Promise.all(
      rawDocuments.map(async (doc) => {
        let downloadUrl: string | null = null;
        if (doc.path) {
          try {
            const { data: signed } = await supabaseAdmin.storage
              .from("expert-applications")
              .createSignedUrl(doc.path, 3600);
            downloadUrl = signed?.signedUrl ?? null;
          } catch {
            downloadUrl = null;
          }
        }
        return {
          ...doc,
          downloadUrl,
        };
      }),
    );

    // Fetch decisions history if any
    const { data: decisions } = await supabaseAdmin
      .from("review_decisions")
      .select("id, decision, rationale, decided_by, created_at")
      .eq("subject_id", subj.id)
      .order("created_at", { ascending: false });

    const rawPayload = (payload ?? {}) as Record<string, unknown>;

    return {
      subjectId: subj.id,
      draftId: draft?.id ?? null,
      submitterId: subj.submitted_by,
      applicantName:
        (typeof rawPayload.fullName === "string" && rawPayload.fullName) ||
        (typeof rawPayload.display_name === "string" && rawPayload.display_name) ||
        subj.title ||
        "Nama Tidak Tertera",
      email: payload?.email ?? null,
      phone: payload?.phone ?? null,
      institution: payload?.institution ?? null,
      country: payload?.country ?? null,
      jobTitle: payload?.title ?? null,
      roles: Array.isArray(payload?.roles) ? (payload.roles as string[]) : [],
      expertise: Array.isArray(payload?.expertise) ? (payload.expertise as string[]) : [],
      biography: payload?.biography ?? null,
      languages: typeof payload?.languages === "string" ? payload.languages : null,
      yearsExperience:
        typeof payload?.yearsExperience === "string" ? payload.yearsExperience : null,
      publications: typeof payload?.publications === "string" ? payload.publications : null,
      keyProjects: typeof payload?.keyProjects === "string" ? payload.keyProjects : null,
      status: subj.current_status,
      createdAt: subj.created_at,
      updatedAt: subj.updated_at,
      documentsCount: documentsWithUrls.length,
      documents: documentsWithUrls,
      decisionsHistory: (decisions ?? []).map((d) => ({
        id: d.id,
        decision: d.decision,
        rationale: d.rationale,
        decidedBy: d.decided_by,
        createdAt: d.created_at,
      })),
    };
  });

export const recordAdminExpertDecision = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        subjectId: z.string().uuid(),
        decision: DecisionType,
        rationale: z.string().max(5000).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data: input, context }) => {
    if (!(await assertAdminOrReviewer(context))) {
      throw new Error("forbidden");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const adminAny = supabaseAdmin as any;

    if (input.decision === "return_for_revision") {
      const { data: decId, error } = await supabaseAdmin.rpc("return_for_revision", {
        _subject_id: input.subjectId,
        _rationale: input.rationale ?? "",
      });
      if (error) throw new Error(error.message);
      return { success: true, decisionId: decId, decision: input.decision };
    }

    // Approve or Reject
    const { data: decId, error } = await supabaseAdmin.rpc("finalize_decision", {
      _subject_id: input.subjectId,
      _decision: input.decision,
      _rationale: input.rationale ?? "",
    });
    if (error) throw new Error(error.message);

    if (input.decision === "approve") {
      try {
        // Publish to public experts directory
        await adminAny.rpc("expert_publish_from_decision", {
          _subject_id: input.subjectId,
          _decision_id: decId,
        });

        // Grant expert RBAC role to applicant
        const { data: sub } = await supabaseAdmin
          .from("review_subjects")
          .select("submitted_by")
          .eq("id", input.subjectId)
          .single();

        if (sub?.submitted_by) {
          await adminAny.rpc("assign_rbac_role", {
            _target_user_id: sub.submitted_by,
            _role_code: "expert",
          });
        }
      } catch (publishErr) {
        console.error("[recordAdminExpertDecision] post-decision error:", publishErr);
      }
    }

    return { success: true, decisionId: decId, decision: input.decision };
  });
