import type { SessionInfo } from './types';

type HomeStatusKind = 'loading' | 'ready' | 'empty' | 'error';

export interface HomeOpenF1Status {
  kind: HomeStatusKind;
  year: number | null;
  isLive: boolean;
  trackStatusText: string;
  progressText: string;
  sessionPrimary: string;
  sessionSecondary: string;
}

function isRaceLikeSession(session: SessionInfo): boolean {
  const name = session.session_name.toLowerCase();
  const type = session.session_type.toLowerCase();
  return name.includes('race') || name.includes('sprint') || type.includes('race') || type.includes('sprint');
}

function selectRelevantSession(sessions: SessionInfo[], now: number): SessionInfo | null {
  const raceSessions = sessions.filter(isRaceLikeSession);
  if (raceSessions.length === 0) return null;

  const liveCandidates = raceSessions
    .filter((session) => {
      const start = new Date(session.date_start).getTime();
      const end = new Date(session.date_end).getTime();
      return start <= now && now < end;
    })
    .sort((a, b) => new Date(b.date_start).getTime() - new Date(a.date_start).getTime());

  if (liveCandidates.length > 0) {
    return liveCandidates[0];
  }

  const completedCandidates = raceSessions
    .filter((session) => new Date(session.date_end).getTime() <= now)
    .sort((a, b) => new Date(b.date_end).getTime() - new Date(a.date_end).getTime());

  if (completedCandidates.length > 0) {
    return completedCandidates[0];
  }

  return raceSessions.sort((a, b) => new Date(a.date_start).getTime() - new Date(b.date_start).getTime())[0];
}

export function deriveHomeOpenF1Status(input: {
  sessions: SessionInfo[];
  isLoading: boolean;
  hasError: boolean;
  year: number | null;
  now?: number;
}): HomeOpenF1Status {
  const { sessions, isLoading, hasError, year } = input;
  const now = input.now ?? Date.now();

  if (hasError) {
    return {
      kind: 'error',
      year,
      isLive: false,
      trackStatusText: 'Unavailable',
      progressText: 'Connection issue',
      sessionPrimary: 'OpenF1 status unavailable',
      sessionSecondary: 'Lobby actions still work. Retry shortly.',
    };
  }

  if (isLoading) {
    return {
      kind: 'loading',
      year,
      isLive: false,
      trackStatusText: 'Loading',
      progressText: 'Loading',
      sessionPrimary: 'Loading OpenF1 status...',
      sessionSecondary: 'Checking race and sprint sessions',
    };
  }

  const selected = selectRelevantSession(sessions, now);
  if (!selected) {
    const noDataYear = year ?? new Date(now).getFullYear();
    return {
      kind: 'empty',
      year: noDataYear,
      isLive: false,
      trackStatusText: 'No data',
      progressText: 'No session',
      sessionPrimary: `No race status available for ${noDataYear}`,
      sessionSecondary: 'OpenF1 has no race/sprint sessions for this year yet.',
    };
  }

  const start = new Date(selected.date_start).getTime();
  const end = new Date(selected.date_end).getTime();
  const isLive = start <= now && now < end;
  const seasonYear = selected.year ?? year ?? new Date(now).getFullYear();

  return {
    kind: 'ready',
    year: seasonYear,
    isLive,
    trackStatusText: isLive ? 'Live' : 'Completed',
    progressText: isLive ? 'In Progress' : 'Finalized',
    sessionPrimary: `${selected.session_name} · ${selected.location}`,
    sessionSecondary: `${selected.circuit_short_name} · ${selected.country_name} · ${seasonYear}`,
  };
}
