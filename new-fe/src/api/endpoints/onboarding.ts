/**
 * doc/api_event_contract.md §2 — Onboarding Flow
 * Landing, input submission, classification, dialogue flows, scale inputs.
 */
import { http } from "@/api/httpClient";

export const onboardingApi = {
  // ── Input submission ──
  submitInput: (projectId: string, body: RawUserInput) =>
    http.post<InputAccepted>(`/api/v1/projects/${projectId}/input`, body),

  uploadFile: (projectId: string, formData: FormData) =>
    http.postForm<FileUploadResult>(`/api/v1/projects/${projectId}/upload`, formData),

  connectGit: (projectId: string, body: GitConnectRequest) =>
    http.post<GitConnectResult>(`/api/v1/projects/${projectId}/git-connect`, body),

  // ── Classification ──
  overrideClassification: (projectId: string, body: ClassificationOverride) =>
    http.post<RichnessClassification>(`/api/v1/projects/${projectId}/classification/override`, body),

  // ── Dialogue flows ──
  getMinimalistDialogue: (projectId: string) =>
    http.get<MinimalistDialogue>(`/api/v1/projects/${projectId}/dialogue/minimalist`),

  submitMinimalistResponse: (projectId: string, body: MinimalistResponse) =>
    http.post<DialogueResult>(`/api/v1/projects/${projectId}/dialogue/minimalist`, body),

  getSeedBuilderDialogue: (projectId: string) =>
    http.get<SeedBuilderDialogue>(`/api/v1/projects/${projectId}/dialogue/seed`),

  submitSeedBuilderResponse: (projectId: string, body: SeedBuilderResponse) =>
    http.post<DialogueResult>(`/api/v1/projects/${projectId}/dialogue/seed`, body),

  // ── Scale & hosting ──
  submitScale: (projectId: string, body: ScaleInputs) =>
    http.post<ScaleValidationResult>(`/api/v1/projects/${projectId}/scale`, body),

  // Contract says `GET /scale/options` with a `ScaleInputs` body - the
  // backend (be/src/bluebox/interfaces/api/routers/scaling.py) implements
  // it as `POST` instead (a GET with a meaningful body isn't idiomatic REST
  // and FastAPI doesn't support it cleanly), with `scale_persona` as a
  // query param defaulting server-side to "MEDIUM" since this UI doesn't
  // expose persona selection.
  getHostingOptions: (projectId: string, body: ScaleInputs) =>
    http.post<HostingOptionsMatrix>(`/api/v1/projects/${projectId}/scale/options`, body),

  // Not part of doc/api_event_contract.md - added so PRDPanel can show a
  // previously-submitted PRD once a project is past onboarding (404 if
  // /input was never called for this project). See PrdSubmission's comment
  // in src/api/types/types.d.ts.
  getPrdSubmission: (projectId: string) =>
    http.get<PrdSubmission>(`/api/v1/projects/${projectId}/prd`),

  // Not part of doc/api_event_contract.md - back the PRD Analysis Report's
  // per-section actions (doc/prd.md AC-RI-06), same precedent as getPrdSubmission above.
  mapUnmappedSectionToStage: (projectId: string, body: { section_name: string; stage: number }) =>
    http.post<PRDAnalysisReportType>(`/api/v1/projects/${projectId}/prd/unmapped-sections/map-to-stage`, body),

  saveUnmappedSectionAsAnnotation: (projectId: string, body: { section_name: string }) =>
    http.post<PRDAnalysisReportType>(`/api/v1/projects/${projectId}/prd/unmapped-sections/save-as-annotation`, body),

  markUnmappedSectionOutOfScope: (projectId: string, body: { section_name: string }) =>
    http.post<PRDAnalysisReportType>(`/api/v1/projects/${projectId}/prd/unmapped-sections/mark-out-of-scope`, body),

  generateMissingSectionContent: (projectId: string, body: { section_name: string }) =>
    http.post<PRDAnalysisReportType>(`/api/v1/projects/${projectId}/prd/missing-sections/generate`, body),

  addThinSectionDetail: (projectId: string, body: { section_name: string }) =>
    http.post<PRDAnalysisReportType>(`/api/v1/projects/${projectId}/prd/thin-sections/add-detail`, body),
};
