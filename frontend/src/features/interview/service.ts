import { api } from "../../services/api.ts";
import type { ChangeTopic, Feedback, PlanResult, QuestionBank } from "./types.ts";

type PlanBody = {
  role_title: string; items: { id: string; kind: string; label: string; text: string }[];
  bank: { id: string; question: string }[]; topics: ChangeTopic[]; count: number; items_reviewed: boolean;
};
type FeedbackBody = {
  question: { text: string; kind: string; item_label: string | null }; answer: string; role_title: string; attempt: number;
  follow_ups_asked: number; skills: { id: number; name: string }[];
};
export const interviewService = {
  bank: (occupationCode: string, signal: AbortSignal) =>
    api.get<QuestionBank>(`/interview/question-bank?occupation_code=${encodeURIComponent(occupationCode)}&limit=12`, signal),
  plan: (body: PlanBody, signal: AbortSignal) => api.post<PlanResult>("/interview/plan", body, 60000, signal),
  feedback: (body: FeedbackBody, signal: AbortSignal) => api.post<Feedback>("/interview/feedback", body, 60000, signal),
};
