import type {
  RaceSnapshot,
  DriverState,
  TrackStatus,
  OpenF1Driver,
  OpenF1Lap,
  OpenF1Position,
  OpenF1Interval,
  OpenF1Pit,
  OpenF1Stint,
  OpenF1RaceControl,
  DerivedSignals,
  SessionMode,
} from '../types';
import type { OpenF1Client } from './openf1Client';

interface SnapshotStoreOptions {
  onSnapshotUpdate?: (snapshot: RaceSnapshot) => void;
  onLapComplete?: (snapshot: RaceSnapshot) => void;
}

interface DriverData {
  driver: OpenF1Driver | null;
  latestPosition: OpenF1Position | null;
  latestInterval: OpenF1Interval | null;
  latestLap: OpenF1Lap | null;
  pits: OpenF1Pit[];
  latestStint: OpenF1Stint | null;
}

const DEBUG_DRIVER_PROVENANCE = process.env.DEBUG_DRIVER_PROVENANCE === 'true';

function toTimestamp(value: string | null | undefined): number {
  if (!value) return 0;
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
}

function hasNewerTimestamp(
  incoming: string | null | undefined,
  existing: string | null | undefined
): boolean {
  return toTimestamp(incoming) >= toTimestamp(existing);
}

export class SnapshotStore {
  private sessionId: string | null = null;
  private currentSnapshot: RaceSnapshot | null = null;
  private previousSnapshot: RaceSnapshot | null = null;
  private drivers: Map<number, DriverData> = new Map();
  private lapNumber = 0;
  private trackStatus: TrackStatus = 'GREEN';
  private totalLaps: number | null = null;
  private options: SnapshotStoreOptions;
  private previousGaps: Map<number, number> = new Map();
  private sessionMode: SessionMode = 'live';
  private replaySpeed: number | null = null;
  private isReplayComplete = false;
  private client: OpenF1Client;

  constructor(client: OpenF1Client, options: SnapshotStoreOptions = {}) {
    this.client = client;
    this.options = options;
  }

  async initialize(sessionId: number, config?: { sessionMode?: SessionMode; replaySpeed?: number | null }): Promise<void> {
    this.sessionId = String(sessionId);
    this.drivers.clear();
    this.lapNumber = 0;
    this.currentSnapshot = null;
    this.previousSnapshot = null;
    this.previousGaps.clear();
    this.trackStatus = 'GREEN';
    this.isReplayComplete = false;
    this.sessionMode = config?.sessionMode ?? 'live';
    this.replaySpeed = config?.replaySpeed ?? null;

    const driverData = await this.client.getDrivers();
    if (driverData) {
      for (const driver of driverData) {
        this.drivers.set(driver.driver_number, {
          driver,
          latestPosition: null,
          latestInterval: null,
          latestLap: null,
          pits: [],
          latestStint: null,
        });
      }
    }
  }

  setTotalLaps(totalLaps: number | null): void {
    this.totalLaps = totalLaps && totalLaps > 0 ? totalLaps : null;

    if (this.currentSnapshot) {
      this.currentSnapshot.totalLaps = this.totalLaps;
      this.options.onSnapshotUpdate?.(this.currentSnapshot);
    }
  }

  setSessionContext(config: { sessionMode: SessionMode; replaySpeed?: number | null }): void {
    this.sessionMode = config.sessionMode;
    this.replaySpeed = config.replaySpeed ?? null;
    if (this.currentSnapshot) {
      this.currentSnapshot.sessionMode = this.sessionMode;
      this.currentSnapshot.replaySpeed = this.replaySpeed;
    }
  }

  getCurrentSnapshot(): RaceSnapshot | null {
    return this.currentSnapshot;
  }

  getPreviousSnapshot(): RaceSnapshot | null {
    return this.previousSnapshot;
  }

  processLapCompletion(lap: OpenF1Lap): void {
    const driverData = this.drivers.get(lap.driver_number);
    if (driverData) {
      driverData.latestLap = lap;
    }

    if (lap.lap_number > this.lapNumber) {
      this.lapNumber = lap.lap_number;
      if (this.sessionMode === 'live' && (this.totalLaps === null || this.lapNumber > this.totalLaps)) {
        this.totalLaps = this.lapNumber;
      }
    }

    this.buildSnapshot();
    if (this.currentSnapshot) {
      this.options.onLapComplete?.(this.currentSnapshot);
    }
  }

  processPositionUpdate(positions: OpenF1Position[]): void {
    for (const pos of positions) {
      const driverData = this.drivers.get(pos.driver_number);
      if (driverData && hasNewerTimestamp(pos.date, driverData.latestPosition?.date)) {
        driverData.latestPosition = pos;
      }
    }
  }

  processIntervalUpdate(intervals: OpenF1Interval[]): void {
    for (const interval of intervals) {
      if (interval.gap_to_leader !== null) {
        this.previousGaps.set(interval.driver_number, interval.gap_to_leader);
      }
    }

    for (const interval of intervals) {
      const driverData = this.drivers.get(interval.driver_number);
      if (driverData && hasNewerTimestamp(interval.date, driverData.latestInterval?.date)) {
        driverData.latestInterval = interval;
      }
    }
  }

  processPitUpdate(pits: OpenF1Pit[]): void {
    for (const pit of pits) {
      const driverData = this.drivers.get(pit.driver_number);
      if (driverData) {
        const existingPit = driverData.pits.find((record) => record.number === pit.number);
        if (!existingPit) {
          driverData.pits.push(pit);
        }
      }
    }
  }

  processStintUpdate(stints: OpenF1Stint[]): void {
    for (const stint of stints) {
      const driverData = this.drivers.get(stint.driver_number);
      if (!driverData) {
        continue;
      }

      const currentStint = driverData.latestStint;
      const hasStintTimestamp = Boolean(stint.date);
      const hasCurrentTimestamp = Boolean(currentStint?.date);
      const shouldReplace = !currentStint
        || (
          hasStintTimestamp
          && hasCurrentTimestamp
          && hasNewerTimestamp(stint.date, currentStint.date)
        )
        || (
          hasStintTimestamp
          && !hasCurrentTimestamp
        )
        || stint.stint_number > currentStint.stint_number
        || (
          stint.stint_number === currentStint.stint_number
          && (stint.lap_start ?? 0) >= (currentStint.lap_start ?? 0)
        );

      if (shouldReplace) {
        driverData.latestStint = stint;
      }
    }
  }

  processRaceControlUpdate(messages: OpenF1RaceControl[]): void {
    const nextTrackStatus = this.client.parseTrackStatus(messages);

    if (nextTrackStatus === this.trackStatus) {
      return;
    }

    this.trackStatus = nextTrackStatus;

    if (this.currentSnapshot) {
      this.buildSnapshot();
    }
  }

  handleFeedStall(stalled: boolean): void {
    if (this.currentSnapshot) {
      this.currentSnapshot.dataFeedStalled = stalled;
      this.options.onSnapshotUpdate?.(this.currentSnapshot);
    }
  }

  markReplayComplete(): void {
    this.isReplayComplete = true;
    if (this.currentSnapshot) {
      this.currentSnapshot.isReplayComplete = true;
      this.options.onSnapshotUpdate?.(this.currentSnapshot);
    }
  }

  private buildSnapshot(): void {
    if (!this.sessionId) return;

    this.previousSnapshot = this.currentSnapshot;
    const driverStates: DriverState[] = [];

    for (const [driverNumber, data] of this.drivers) {
      if (!data.driver) continue;

      const tyreAge = this.calculateTyreAge(data);
      const name = data.driver.full_name || data.driver.broadcast_name || `Driver ${driverNumber}`;
      const nameSource = data.driver.full_name
        ? 'full_name'
        : data.driver.broadcast_name
          ? 'broadcast_name'
          : 'unknown';

      driverStates.push({
        driverNumber,
        name,
        nameSource,
        lastTelemetryTimestamp: this.getDriverTelemetryTimestamp(data),
        team: data.driver.team_name,
        position: data.latestPosition?.position ?? 0,
        gap: data.latestInterval?.gap_to_leader ?? null,
        interval: data.latestInterval?.interval ?? null,
        tyreCompound: data.latestStint?.compound ?? null,
        tyreAge: this.calculateCurrentTyreAge(data, tyreAge),
        stintNumber: data.latestStint?.stint_number ?? null,
        drsEnabled: false,
        pitCount: data.pits.length,
        lastLapTime: data.latestLap?.lap_duration ?? null,
        inPit: false,
        retired: false,
      });
    }

    driverStates.sort((a, b) => a.position - b.position);
    const leader = driverStates[0];

    this.currentSnapshot = {
      sessionId: this.sessionId,
      lapNumber: this.lapNumber,
      totalLaps: this.totalLaps,
      trackStatus: this.trackStatus,
      sessionMode: this.sessionMode,
      replaySpeed: this.replaySpeed,
      isReplayComplete: this.isReplayComplete,
      drivers: driverStates,
      timestamp: new Date(),
      dataFeedStalled: false,
      leaderLapTime: leader?.lastLapTime ?? null,
    };

    if (DEBUG_DRIVER_PROVENANCE && leader) {
      console.debug('[snapshot-driver-provenance]', {
        leader: leader.name,
        source: leader.nameSource ?? 'unknown',
        telemetryTimestamp: leader.lastTelemetryTimestamp ?? null,
      });
    }

    this.options.onSnapshotUpdate?.(this.currentSnapshot);
  }

  private calculateTyreAge(data: DriverData): number {
    const lastPitLap = data.pits.length > 0
      ? Math.max(...data.pits.map((pit) => pit.lap_number))
      : 0;
    return this.lapNumber - lastPitLap;
  }

  private calculateCurrentTyreAge(data: DriverData, fallbackTyreAge: number): number {
    const stint = data.latestStint;
    if (!stint) {
      return fallbackTyreAge;
    }

    const lapStart = stint.lap_start ?? null;
    const tyreAgeAtStart = stint.tyre_age_at_start ?? 0;

    if (lapStart === null) {
      return fallbackTyreAge;
    }

    return Math.max(tyreAgeAtStart, tyreAgeAtStart + Math.max(0, this.lapNumber - lapStart));
  }

  private getDriverTelemetryTimestamp(data: DriverData): string | null {
    const timestamps = [
      data.latestPosition?.date ?? null,
      data.latestInterval?.date ?? null,
      data.latestLap?.date_start ?? null,
      data.latestStint?.date ?? null,
      data.pits.length > 0 ? data.pits[data.pits.length - 1]?.date ?? null : null,
    ];

    let latestValue: string | null = null;
    let latestTimestamp = 0;

    for (const value of timestamps) {
      const parsed = toTimestamp(value);
      if (parsed >= latestTimestamp && value) {
        latestTimestamp = parsed;
        latestValue = value;
      }
    }

    return latestValue;
  }

  calculateDerivedSignals(): DerivedSignals {
    const snapshot = this.currentSnapshot;
    if (!snapshot) {
      return {
        closingTrend: new Map(),
        withinOneSecond: new Map(),
        overtakeOpportunity: new Map(),
        pitWindowOpen: new Map(),
        tyreCliffRisk: new Map(),
        lateRacePhase: false,
        podiumStabilityTrend: false,
        closeBattles: [],
      };
    }

    const closingTrend = new Map<number, boolean>();
    const withinOneSecond = new Map<number, boolean>();
    const overtakeOpportunity = new Map<number, boolean>();
    const pitWindowOpen = new Map<number, boolean>();
    const tyreCliffRisk = new Map<number, boolean>();
    const closeBattles: { attacker: number; defender: number; gap: number }[] = [];

    for (const driver of snapshot.drivers) {
      const prevGap = this.previousGaps.get(driver.driverNumber);
      const currentGap = driver.gap;
      const isClosing = prevGap !== undefined && currentGap !== null ? prevGap - currentGap > 0.1 : false;
      closingTrend.set(driver.driverNumber, isClosing);
      withinOneSecond.set(driver.driverNumber, driver.interval !== null && driver.interval <= 1.0);
      overtakeOpportunity.set(driver.driverNumber, isClosing && driver.interval !== null && driver.interval <= 1.5);

      pitWindowOpen.set(driver.driverNumber, driver.tyreAge >= 15 && driver.pitCount < 2);
      tyreCliffRisk.set(driver.driverNumber, driver.tyreAge >= 25);

      if (driver.interval !== null && driver.interval < 4.0 && driver.position > 1) {
        const defender = snapshot.drivers.find((candidate) => candidate.position === driver.position - 1);
        if (defender) {
          closeBattles.push({
            attacker: driver.driverNumber,
            defender: defender.driverNumber,
            gap: driver.interval,
          });
        }
      }
    }

    return {
      closingTrend,
      withinOneSecond,
      overtakeOpportunity,
      pitWindowOpen,
      tyreCliffRisk,
      lateRacePhase: snapshot.totalLaps !== null ? snapshot.lapNumber >= Math.ceil(snapshot.totalLaps * 0.6) : false,
      podiumStabilityTrend: false,
      closeBattles,
    };
  }
}
