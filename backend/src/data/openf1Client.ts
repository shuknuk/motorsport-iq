import type {
  OpenF1Session,
  OpenF1Driver,
  OpenF1Lap,
  OpenF1Position,
  OpenF1Interval,
  OpenF1Pit,
  OpenF1CarData,
  OpenF1RaceControl,
  TrackStatus,
} from '../types';

const OPENF1_BASE_URL = process.env.OPENF1_BASE_URL || 'https://api.openf1.org/v1';
const POLLING_INTERVAL = 10000; // 10 seconds
const MAX_RETRIES = 4;
const BASE_BACKOFF = 10000; // 10 seconds

type FetchType = typeof fetch;

interface OpenF1ClientOptions {
  onSessionUpdate?: (session: OpenF1Session) => void;
  onLapCompletion?: (lap: OpenF1Lap) => void;
  onPositionUpdate?: (positions: OpenF1Position[]) => void;
  onIntervalUpdate?: (intervals: OpenF1Interval[]) => void;
  onPitUpdate?: (pits: OpenF1Pit[]) => void;
  onRaceControlUpdate?: (messages: OpenF1RaceControl[]) => void;
  onError?: (error: Error) => void;
  onFeedStall?: (stalled: boolean) => void;
}

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

export class OpenF1Client {
  private sessionId: number | null = null;
  private pollingInterval: NodeJS.Timeout | null = null;
  private lastDataTime: Date | null = null;
  private feedStalled = false;
  private consecutiveErrors = 0;
  private currentBackoff = BASE_BACKOFF;
  private isPolling = false;
  private cache: Map<string, CacheEntry<unknown>> = new Map();
  private lastLapNumbers: Map<number, number> = new Map(); // driver -> last lap number
  private options: OpenF1ClientOptions;

  constructor(options: OpenF1ClientOptions = {}) {
    this.options = options;
  }

  /**
   * Set the session to monitor
   */
  setSession(sessionId: number): void {
    this.sessionId = sessionId;
    this.lastLapNumbers.clear();
    this.lastDataTime = null;
    this.feedStalled = false;
  }

  /**
   * Start polling for data
   */
  startPolling(): void {
    if (this.pollingInterval) {
      this.stopPolling();
    }

    this.pollingInterval = setInterval(() => {
      this.poll().catch((err) => {
        console.error('Polling error:', err);
        this.options.onError?.(err);
      });
    }, POLLING_INTERVAL);

    // Initial poll
    this.poll().catch((err) => {
      console.error('Initial poll error:', err);
      this.options.onError?.(err);
    });
  }

  /**
   * Stop polling
   */
  stopPolling(): void {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
    }
  }

  /**
   * Main polling loop
   */
  private async poll(): Promise<void> {
    if (!this.sessionId || this.isPolling) return;

    this.isPolling = true;

    try {
      // Fetch all data in parallel
      const [laps, positions, intervals, pits, raceControl] = await Promise.all([
        this.fetchLaps(),
        this.fetchPositions(),
        this.fetchIntervals(),
        this.fetchPits(),
        this.fetchRaceControl(),
      ]);

      // Check for new lap completions
      if (laps) {
        for (const lap of laps) {
          const lastLap = this.lastLapNumbers.get(lap.driver_number);
          if (lastLap === undefined || lap.lap_number > lastLap) {
            this.lastLapNumbers.set(lap.driver_number, lap.lap_number);
            if (lastLap !== undefined) {
              // Not the first lap we've seen for this driver
              this.options.onLapCompletion?.(lap);
            }
          }
        }
      }

      // Update last data time and check for feed stall
      const now = new Date();
      if (laps && laps.length > 0) {
        this.lastDataTime = now;
        if (this.feedStalled) {
          this.feedStalled = false;
          this.options.onFeedStall?.(false);
        }
      } else {
        // Check if feed has stalled (> 30 seconds without data)
        if (this.lastDataTime && now.getTime() - this.lastDataTime.getTime() > 30000) {
          if (!this.feedStalled) {
            this.feedStalled = true;
            this.options.onFeedStall?.(true);
          }
        }
      }

      // Notify of updates
      if (positions) this.options.onPositionUpdate?.(positions);
      if (intervals) this.options.onIntervalUpdate?.(intervals);
      if (pits) this.options.onPitUpdate?.(pits);
      if (raceControl) this.options.onRaceControlUpdate?.(raceControl);

      // Reset error state on success
      this.consecutiveErrors = 0;
      this.currentBackoff = BASE_BACKOFF;
    } catch (error) {
      this.consecutiveErrors++;
      console.error(`Polling error (${this.consecutiveErrors} consecutive):`, error);

      // Exponential backoff: 10s -> 20s -> 40s -> 80s
      if (this.consecutiveErrors >= MAX_RETRIES) {
        this.currentBackoff = Math.min(this.currentBackoff * 2, 80000);
      }

      this.options.onError?.(error instanceof Error ? error : new Error(String(error)));
    } finally {
      this.isPolling = false;
    }
  }

  /**
   * Fetch with caching and error handling
   */
  private async fetchWithCache<T>(
    endpoint: string,
    params: Record<string, string | number>,
    maxAge = 5000
  ): Promise<T | null> {
    const cacheKey = `${endpoint}?${new URLSearchParams(
      Object.entries(params).map(([k, v]) => [k, String(v)])
    ).toString()}`;

    // Check cache
    const cached = this.cache.get(cacheKey) as CacheEntry<T> | undefined;
    if (cached && Date.now() - cached.timestamp < maxAge) {
      return cached.data;
    }

    try {
      const url = `${OPENF1_BASE_URL}${endpoint}?${new URLSearchParams(
        Object.entries(params).map(([k, v]) => [k, String(v)])
      )}`;

      const response = await fetch(url);

      if (response.status === 429 || response.status >= 500) {
        throw new Error(`Rate limited or server error: ${response.status}`);
      }

      if (!response.ok) {
        throw new Error(`HTTP error: ${response.status}`);
      }

      const data = await response.json();

      // Cache the result
      this.cache.set(cacheKey, { data, timestamp: Date.now() });

      return data as T;
    } catch (error) {
      console.error(`Error fetching ${endpoint}:`, error);
      // Return cached data if available, even if stale
      if (cached) {
        return cached.data;
      }
      throw error;
    }
  }

  /**
   * Get all available sessions
   */
  async getSessions(year?: number, meetingKey?: number): Promise<OpenF1Session[] | null> {
    const params: Record<string, string | number> = {};
    if (year) params.year = year;
    if (meetingKey) params.meeting_key = meetingKey;

    return this.fetchWithCache<OpenF1Session[]>('/sessions', params, 60000);
  }

  /**
   * Get current/recent session
   */
  async getCurrentSession(): Promise<OpenF1Session | null> {
    const sessions = await this.getSessions();
    if (!sessions || sessions.length === 0) return null;

    // Return the most recent session
    const sorted = sessions.sort(
      (a, b) => new Date(b.date_start).getTime() - new Date(a.date_start).getTime()
    );
    return sorted[0];
  }

  /**
   * Get drivers for current session
   */
  async getDrivers(): Promise<OpenF1Driver[] | null> {
    if (!this.sessionId) return null;

    return this.fetchWithCache<OpenF1Driver[]>('/drivers', {
      session_key: this.sessionId,
    }, 30000);
  }

  /**
   * Get laps for current session
   */
  async fetchLaps(driverNumber?: number): Promise<OpenF1Lap[] | null> {
    if (!this.sessionId) return null;

    const params: Record<string, string | number> = { session_key: this.sessionId };
    if (driverNumber) params.driver_number = driverNumber;

    return this.fetchWithCache<OpenF1Lap[]>('/laps', params, 5000);
  }

  /**
   * Get latest positions
   */
  async fetchPositions(): Promise<OpenF1Position[] | null> {
    if (!this.sessionId) return null;

    return this.fetchWithCache<OpenF1Position[]>('/position', {
      session_key: this.sessionId,
    }, 2000);
  }

  /**
   * Get intervals (gaps)
   */
  async fetchIntervals(): Promise<OpenF1Interval[] | null> {
    if (!this.sessionId) return null;

    return this.fetchWithCache<OpenF1Interval[]>('/intervals', {
      session_key: this.sessionId,
    }, 2000);
  }

  /**
   * Get pit stops
   */
  async fetchPits(): Promise<OpenF1Pit[] | null> {
    if (!this.sessionId) return null;

    return this.fetchWithCache<OpenF1Pit[]>('/pit', {
      session_key: this.sessionId,
    }, 5000);
  }

  /**
   * Get car data (for DRS)
   */
  async fetchCarData(driverNumber?: number): Promise<OpenF1CarData[] | null> {
    if (!this.sessionId) return null;

    const params: Record<string, string | number> = { session_key: this.sessionId };
    if (driverNumber) params.driver_number = driverNumber;

    return this.fetchWithCache<OpenF1CarData[]>('/car_data', params, 1000);
  }

  /**
   * Get race control messages (flags, SC, etc.)
   */
  async fetchRaceControl(): Promise<OpenF1RaceControl[] | null> {
    if (!this.sessionId) return null;

    return this.fetchWithCache<OpenF1RaceControl[]>('/race_control', {
      session_key: this.sessionId,
    }, 2000);
  }

  /**
   * Parse track status from race control messages
   */
  parseTrackStatus(messages: OpenF1RaceControl[]): TrackStatus {
    // Sort by date, most recent first
    const sorted = messages
      .filter((m) => m.flag || m.category === 'SafetyCar')
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    if (sorted.length === 0) return 'GREEN';

    const latest = sorted[0];

    // Check for red flag
    if (latest.flag?.toLowerCase() === 'red') return 'RED';

    // Check for safety car
    if (
      latest.category === 'SafetyCar' ||
      latest.flag?.toLowerCase() === 'sc' ||
      latest.message?.toLowerCase().includes('safety car')
    ) {
      // Check if it's VSC
      if (
        latest.message?.toLowerCase().includes('virtual') ||
        latest.flag?.toLowerCase() === 'vsc'
      ) {
        return 'VSC';
      }
      return 'SC';
    }

    return 'GREEN';
  }

  /**
   * Get the feed stall status
   */
  isFeedStalled(): boolean {
    return this.feedStalled;
  }

  /**
   * Get current session ID
   */
  getSessionId(): number | null {
    return this.sessionId;
  }
}

// Singleton instance
let clientInstance: OpenF1Client | null = null;

export function getOpenF1Client(options?: OpenF1ClientOptions): OpenF1Client {
  if (!clientInstance) {
    clientInstance = new OpenF1Client(options);
  } else if (options) {
    // Update options
    clientInstance['options'] = { ...clientInstance['options'], ...options };
  }
  return clientInstance;
}