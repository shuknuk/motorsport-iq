import type {
  RaceSnapshot,
  DriverState,
  TrackStatus,
  OpenF1Driver,
  OpenF1Lap,
  OpenF1Position,
  OpenF1Interval,
  OpenF1Pit,
  OpenF1RaceControl,
  DerivedSignals,
} from '../types';
import { getOpenF1Client } from './openf1Client';

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
}

export class SnapshotStore {
  private sessionId: string | null = null;
  private currentSnapshot: RaceSnapshot | null = null;
  private previousSnapshot: RaceSnapshot | null = null;
  private drivers: Map<number, DriverData> = new Map();
  private lapNumber = 0;
  private trackStatus: TrackStatus = 'GREEN';
  private totalLaps: number | null = null;
  private lastUpdateTime: Date | null = null;
  private options: SnapshotStoreOptions;
  private consecutiveNoData = 0;
  private previousGaps: Map<number, number> = new Map(); // driver -> gap to leader

  constructor(options: SnapshotStoreOptions = {}) {
    this.options = options;

    // Set up OpenF1 client callbacks
    const client = getOpenF1Client({
      onLapCompletion: (lap) => this.handleLapCompletion(lap),
      onPositionUpdate: (positions) => this.handlePositionUpdate(positions),
      onIntervalUpdate: (intervals) => this.handleIntervalUpdate(intervals),
      onPitUpdate: (pits) => this.handlePitUpdate(pits),
      onRaceControlUpdate: (messages) => this.handleRaceControlUpdate(messages),
      onFeedStall: (stalled) => this.handleFeedStall(stalled),
    });
  }

  /**
   * Initialize for a specific session
   */
  async initialize(sessionId: number): Promise<void> {
    this.sessionId = String(sessionId);
    this.drivers.clear();
    this.lapNumber = 0;
    this.currentSnapshot = null;
    this.previousSnapshot = null;
    this.previousGaps.clear();

    // Fetch initial driver data
    const client = getOpenF1Client();
    const driverData = await client.getDrivers();

    if (driverData) {
      for (const driver of driverData) {
        this.drivers.set(driver.driver_number, {
          driver,
          latestPosition: null,
          latestInterval: null,
          latestLap: null,
          pits: [],
        });
      }
    }

    console.log(`SnapshotStore initialized for session ${sessionId} with ${this.drivers.size} drivers`);
  }

  /**
   * Get current snapshot
   */
  getCurrentSnapshot(): RaceSnapshot | null {
    return this.currentSnapshot;
  }

  /**
   * Get previous snapshot (for comparison)
   */
  getPreviousSnapshot(): RaceSnapshot | null {
    return this.previousSnapshot;
  }

  /**
   * Handle lap completion event
   */
  private handleLapCompletion(lap: OpenF1Lap): void {
    const driverData = this.drivers.get(lap.driver_number);
    if (driverData) {
      driverData.latestLap = lap;
    }

    // Update max lap number
    if (lap.lap_number > this.lapNumber) {
      this.lapNumber = lap.lap_number;
    }

    // Build new snapshot
    this.buildSnapshot();

    // Notify of lap completion
    if (this.currentSnapshot) {
      this.options.onLapComplete?.(this.currentSnapshot);
    }
  }

  /**
   * Handle position update
   */
  private handlePositionUpdate(positions: OpenF1Position[]): void {
    for (const pos of positions) {
      const driverData = this.drivers.get(pos.driver_number);
      if (driverData) {
        driverData.latestPosition = pos;
      }
    }
    this.lastUpdateTime = new Date();
  }

  /**
   * Handle interval update
   */
  private handleIntervalUpdate(intervals: OpenF1Interval[]): void {
    // Store previous gaps before updating
    for (const interval of intervals) {
      if (interval.gap_to_leader !== null) {
        this.previousGaps.set(interval.driver_number, interval.gap_to_leader);
      }
    }

    for (const interval of intervals) {
      const driverData = this.drivers.get(interval.driver_number);
      if (driverData) {
        driverData.latestInterval = interval;
      }
    }
    this.lastUpdateTime = new Date();
  }

  /**
   * Handle pit update
   */
  private handlePitUpdate(pits: OpenF1Pit[]): void {
    for (const pit of pits) {
      const driverData = this.drivers.get(pit.driver_number);
      if (driverData) {
        // Add pit if not already recorded
        const existingPit = driverData.pits.find((p) => p.number === pit.number);
        if (!existingPit) {
          driverData.pits.push(pit);
        }
      }
    }
  }

  /**
   * Handle race control update
   */
  private handleRaceControlUpdate(messages: OpenF1RaceControl[]): void {
    const client = getOpenF1Client();
    this.trackStatus = client.parseTrackStatus(messages);
  }

  /**
   * Handle feed stall
   */
  private handleFeedStall(stalled: boolean): void {
    if (this.currentSnapshot) {
      this.currentSnapshot.dataFeedStalled = stalled;
    }
  }

  /**
   * Build a new race snapshot
   */
  private buildSnapshot(): void {
    if (!this.sessionId) return;

    // Store previous snapshot
    this.previousSnapshot = this.currentSnapshot;

    // Build driver states
    const driverStates: DriverState[] = [];

    for (const [driverNumber, data] of this.drivers) {
      if (!data.driver) continue;

      // Calculate tyre age (simplified - in real implementation, track tyre stints)
      const tyreAge = this.calculateTyreAge(driverNumber, data);

      // Check if in pit
      const inPit = false; // Would need real-time pit status

      // Check if retired
      const retired = false; // Would need retirement status

      // Get DRS status from car data (simplified)
      const drsEnabled = false; // Would need car data

      driverStates.push({
        driverNumber,
        name: data.driver.broadcast_name || data.driver.full_name,
        team: data.driver.team_name,
        position: data.latestPosition?.position ?? 0,
        gap: data.latestInterval?.gap_to_leader ?? null,
        interval: data.latestInterval?.interval ?? null,
        tyreCompound: null, // Not directly available from OpenF1
        tyreAge,
        drsEnabled,
        pitCount: data.pits.length,
        lastLapTime: data.latestLap?.lap_duration ?? null,
        inPit,
        retired,
      });
    }

    // Sort by position
    driverStates.sort((a, b) => a.position - b.position);

    // Find leader lap time
    const leader = driverStates[0];
    const leaderLapTime = leader?.lastLapTime ?? null;

    // Build snapshot
    this.currentSnapshot = {
      sessionId: this.sessionId,
      lapNumber: this.lapNumber,
      totalLaps: this.totalLaps,
      trackStatus: this.trackStatus,
      drivers: driverStates,
      timestamp: new Date(),
      dataFeedStalled: false,
      leaderLapTime,
    };

    // Notify listeners
    this.options.onSnapshotUpdate?.(this.currentSnapshot);
  }

  /**
   * Calculate tyre age for a driver
   */
  private calculateTyreAge(driverNumber: number, data: DriverData): number {
    // Simplified: assume new tyres each stint
    // In reality, would track tyre compound changes
    const lastPitLap = data.pits.length > 0
      ? Math.max(...data.pits.map((p) => p.lap_number))
      : 0;

    return this.lapNumber - lastPitLap;
  }

  /**
   * Calculate derived signals for trigger evaluation
   */
  calculateDerivedSignals(): DerivedSignals {
    const snapshot = this.currentSnapshot;
    if (!snapshot) {
      return {
        closingTrend: new Map(),
        pitWindowOpen: new Map(),
        tyreCliffRisk: new Map(),
        undercutWindow: new Map(),
        energyAdvantage: new Map(),
        closeBattles: [],
        recentPitters: [],
      };
    }

    const closingTrend = new Map<number, boolean>();
    const pitWindowOpen = new Map<number, boolean>();
    const tyreCliffRisk = new Map<number, boolean>();
    const undercutWindow = new Map<number, boolean>();
    const energyAdvantage = new Map<number, { attacker: number; defender: number }[]>();
    const closeBattles: { attacker: number; defender: number; gap: number }[] = [];
    const recentPitters: number[] = [];

    for (const driver of snapshot.drivers) {
      // Closing trend: gap decreasing > 0.1s
      const prevGap = this.previousGaps.get(driver.driverNumber);
      const currentGap = driver.gap;
      if (prevGap !== undefined && currentGap !== null) {
        closingTrend.set(driver.driverNumber, prevGap - currentGap > 0.1);
      }

      // Pit window open: tyre age >= 15, fewer stops than expected
      pitWindowOpen.set(driver.driverNumber, driver.tyreAge >= 15 && driver.pitCount < 2);

      // Tyre cliff risk: tyre age >= 25
      tyreCliffRisk.set(driver.driverNumber, driver.tyreAge >= 25);

      // Undercut window: gap < 3.0s, pit window open
      undercutWindow.set(
        driver.driverNumber,
        driver.interval !== null && driver.interval < 3.0 && (pitWindowOpen.get(driver.driverNumber) ?? false)
      );

      // Close battles: gap to car ahead < 2.0s
      if (driver.interval !== null && driver.interval < 2.0 && driver.position > 1) {
        const defender = snapshot.drivers.find((d) => d.position === driver.position - 1);
        if (defender) {
          closeBattles.push({
            attacker: driver.driverNumber,
            defender: defender.driverNumber,
            gap: driver.interval,
          });
        }
      }
    }

    // Energy advantage: DRS battles (simplified)
    for (const battle of closeBattles) {
      const attacker = snapshot.drivers.find((d) => d.driverNumber === battle.attacker);
      if (attacker?.drsEnabled) {
        const existing = energyAdvantage.get(battle.attacker) || [];
        existing.push(battle);
        energyAdvantage.set(battle.attacker, existing);
      }
    }

    // Recent pitters: pitted in last 3 laps
    for (const [driverNumber, data] of this.drivers) {
      const lastPitLap = data.pits.length > 0
        ? Math.max(...data.pits.map((p) => p.lap_number))
        : -1;
      if (this.lapNumber - lastPitLap <= 3) {
        recentPitters.push(driverNumber);
      }
    }

    return {
      closingTrend,
      pitWindowOpen,
      tyreCliffRisk,
      undercutWindow,
      energyAdvantage,
      closeBattles,
      recentPitters,
    };
  }

  /**
   * Get driver by number
   */
  getDriver(driverNumber: number): DriverState | null {
    return this.currentSnapshot?.drivers.find((d) => d.driverNumber === driverNumber) ?? null;
  }

  /**
   * Get all drivers sorted by position
   */
  getDriversSorted(): DriverState[] {
    return this.currentSnapshot?.drivers ?? [];
  }
}

// Singleton instance
let storeInstance: SnapshotStore | null = null;

export function getSnapshotStore(options?: SnapshotStoreOptions): SnapshotStore {
  if (!storeInstance) {
    storeInstance = new SnapshotStore(options);
  } else if (options) {
    storeInstance['options'] = { ...storeInstance['options'], ...options };
  }
  return storeInstance;
}