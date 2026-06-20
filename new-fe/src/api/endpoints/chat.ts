/**
 * doc/api_event_contract.md §4.1 — Chat Panel
 * REST endpoints for chat history and message CRUD.
 * Streaming via WebSocket/SSE (see ws/sse handlers).
 */
import { http } from "@/api/httpClient";

export const chatApi = {
  getHistory: (projectId: string, params?: ChatHistoryQuery) =>
    http.get<ChatHistory>(`/api/v1/projects/${projectId}/chat`, { params }),

  sendMessage: (projectId: string, body: ChatMessageInbound) =>
    http.post<ChatMessage>(`/api/v1/projects/${projectId}/chat`, body),

  deleteMessage: (projectId: string, messageId: string) =>
    http.delete<{ deleted: true }>(`/api/v1/projects/${projectId}/chat/${messageId}`),
};
