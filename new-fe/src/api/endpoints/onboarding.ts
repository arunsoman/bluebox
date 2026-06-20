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

  getHostingOptions: (projectId: string, query: ScaleInputs) =>
    http.get<HostingOptionsMatrix>(`/api/v1/projects/${projectId}/scale/options`, query),
};
