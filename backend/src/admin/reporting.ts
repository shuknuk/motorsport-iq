import supabase from '../db/supabaseClient';
import type { AdminProblemReport, CreateProblemReportInput, ProblemReportReason, ProblemReportStatus } from '../types';

const VALID_REASONS: ProblemReportReason[] = [
  'WRONG_ANSWER',
  'BAD_EXPLANATION',
  'UNCLEAR_QUESTION',
  'TELEMETRY_MISMATCH',
  'OTHER',
];

const VALID_STATUSES: ProblemReportStatus[] = ['OPEN', 'REVIEWED', 'RESOLVED', 'DISMISSED'];

export function isProblemReportReason(value: string): value is ProblemReportReason {
  return VALID_REASONS.includes(value as ProblemReportReason);
}

export function isProblemReportStatus(value: string): value is ProblemReportStatus {
  return VALID_STATUSES.includes(value as ProblemReportStatus);
}

function normalizeNote(note?: string): string | null {
  const trimmed = note?.trim();
  return trimmed ? trimmed : null;
}

export async function createOrUpdateProblemReport(input: CreateProblemReportInput): Promise<{ id: string }> {
  if (!isProblemReportReason(input.reason)) {
    throw new Error('Invalid problem report reason');
  }

  const { data: instance, error: instanceError } = await supabase
    .from('question_instances')
    .select()
    .eq('id', input.instanceId)
    .maybeSingle();

  if (instanceError) {
    throw new Error(`Failed to load question instance: ${instanceError.message}`);
  }

  if (!instance || !['RESOLVED', 'EXPLAINED', 'CLOSED'].includes(instance.state)) {
    throw new Error('This question is not available for reporting');
  }

  const { data: user, error: userError } = await supabase
    .from('users')
    .select('id, lobby_id')
    .eq('id', input.userId)
    .maybeSingle();

  if (userError) {
    throw new Error(`Failed to load user: ${userError.message}`);
  }

  if (!user || user.lobby_id !== instance.lobby_id) {
    throw new Error('You can only report questions from your current lobby');
  }

  const { data: answer, error: answerError } = await supabase
    .from('answers')
    .select('answer')
    .eq('instance_id', instance.id)
    .eq('user_id', input.userId)
    .maybeSingle();

  if (answerError) {
    throw new Error(`Failed to load answer snapshot: ${answerError.message}`);
  }

  const payload = {
    instance_id: instance.id,
    user_id: input.userId,
    lobby_id: instance.lobby_id,
    question_id: instance.question_id,
    question_text_snapshot: instance.question_text,
    correct_answer_snapshot: instance.answer,
    explanation_snapshot: instance.explanation,
    reported_answer_snapshot: answer?.answer ?? null,
    reason: input.reason,
    note: normalizeNote(input.note),
    status: 'OPEN' as const,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from('problem_reports')
    .upsert(payload, {
      onConflict: 'instance_id,user_id',
    })
    .select('id')
    .single();

  if (error || !data) {
    throw new Error(`Failed to save problem report: ${error?.message ?? 'unknown error'}`);
  }

  return { id: data.id };
}

export async function listProblemReports(): Promise<AdminProblemReport[]> {
  const { data: reports, error } = await supabase
    .from('problem_reports')
    .select()
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(`Failed to load problem reports: ${error.message}`);
  }

  const userIds = [...new Set((reports ?? []).map((report) => report.user_id))];
  const lobbyIds = [...new Set((reports ?? []).map((report) => report.lobby_id))];

  const [usersResult, lobbiesResult] = await Promise.all([
    userIds.length
      ? supabase.from('users').select('id, username').in('id', userIds)
      : Promise.resolve({ data: [], error: null }),
    lobbyIds.length
      ? supabase.from('lobbies').select('id, code').in('id', lobbyIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (usersResult.error) {
    throw new Error(`Failed to load report users: ${usersResult.error.message}`);
  }

  if (lobbiesResult.error) {
    throw new Error(`Failed to load report lobbies: ${lobbiesResult.error.message}`);
  }

  const usernames = new Map((usersResult.data ?? []).map((user) => [user.id, user.username]));
  const lobbyCodes = new Map((lobbiesResult.data ?? []).map((lobby) => [lobby.id, lobby.code]));

  return (reports ?? []).map((report) => ({
    id: report.id,
    instanceId: report.instance_id,
    userId: report.user_id,
    username: usernames.get(report.user_id) ?? 'Unknown Player',
    lobbyId: report.lobby_id,
    lobbyCode: lobbyCodes.get(report.lobby_id) ?? 'Unknown Lobby',
    questionId: report.question_id,
    questionText: report.question_text_snapshot,
    correctAnswer: report.correct_answer_snapshot,
    explanation: report.explanation_snapshot,
    reportedAnswer: report.reported_answer_snapshot,
    reason: report.reason,
    note: report.note,
    status: report.status,
    createdAt: report.created_at,
    updatedAt: report.updated_at,
    reviewedAt: report.reviewed_at,
  }));
}

export async function updateProblemReportStatus(reportId: string, status: ProblemReportStatus): Promise<void> {
  if (!isProblemReportStatus(status)) {
    throw new Error('Invalid report status');
  }

  const now = new Date().toISOString();
  const { error } = await supabase
    .from('problem_reports')
    .update({
      status,
      updated_at: now,
      reviewed_at: status === 'OPEN' ? null : now,
    })
    .eq('id', reportId);

  if (error) {
    throw new Error(`Failed to update problem report: ${error.message}`);
  }
}
