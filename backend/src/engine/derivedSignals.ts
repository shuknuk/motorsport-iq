import type { RaceSnapshot, DriverState, DerivedSignals } from '../types';

/**
 * Derived Signals - Calculated from RaceSnapshot for trigger evaluation
 */

/**
 * Check if a driver is closing the gap to the car ahead
 * Closing means the gap is decreasing by more than 0.1s per lap
 */
export function isClosingTrend(
  currentGap: number,
  previousGap: number,
  threshold = 0.1
): boolean {
  return previousGap - currentGap > threshold;
}

/**
 * Check if a driver is in the pit window
 * Pit window is open when tyre age >= 15 and they have fewer stops than expected
 */
export function isInPitWindow(
  driver: DriverState,
  expectedPitStops = 2
): boolean {
  return driver.tyreAge >= 15 && driver.pitCount < expectedPitStops;
}

/**
 * Check if a driver is at tyre cliff risk
 * Tyre cliff is when tyre age >= 25
 */
export function isAtTyreCliff(driver: DriverState): boolean {
  return driver.tyreAge >= 25;
}

/**
 * Check if undercut window is open for a driver
 * Undercut opportunity: gap < 3.0s to car ahead and pit window is open
 */
export function isUndercutWindow(
  driver: DriverState,
  pitWindowExpectedStops = 2
): boolean {
  const inPitWindow = isInPitWindow(driver, pitWindowExpectedStops);
  const closeEnough = driver.interval !== null && driver.interval < 3.0;
  return inPitWindow && closeEnough;
}

/**
 * Check if a driver has energy advantage (DRS active while defender doesn't)
 */
export function hasEnergyAdvantage(
  attacker: DriverState,
  defender: DriverState
): boolean {
  return attacker.drsEnabled && !defender.drsEnabled;
}

/**
 * Get all close battles (gap < threshold)
 */
export function getCloseBattles(
  snapshot: RaceSnapshot,
  threshold = 2.0
): { attacker: DriverState; defender: DriverState; gap: number }[] {
  const battles: { attacker: DriverState; defender: DriverState; gap: number }[] = [];

  for (const driver of snapshot.drivers) {
    if (driver.position <= 1 || driver.interval === null) continue;
    if (driver.interval < threshold) {
      const defender = snapshot.drivers.find((d) => d.position === driver.position - 1);
      if (defender) {
        battles.push({
          attacker: driver,
          defender,
          gap: driver.interval,
        });
      }
    }
  }

  return battles;
}

/**
 * Check if gap between two drivers is within a range
 */
export function isGapInRange(
  attacker: DriverState,
  defender: DriverState,
  minGap: number,
  maxGap: number
): boolean {
  // Calculate gap between attacker and defender
  const attackerGap = attacker.gap ?? 0;
  const defenderGap = defender.gap ?? 0;
  const gap = Math.abs(attackerGap - defenderGap);

  return gap >= minGap && gap <= maxGap;
}

/**
 * Check if driver has fresh tyres (tyre age <= maxAge)
 */
export function hasFreshTyres(driver: DriverState, maxAge: number): boolean {
  return driver.tyreAge <= maxAge;
}

/**
 * Check if driver is in a specific position range
 */
export function isInPositionRange(
  driver: DriverState,
  min: number,
  max: number
): boolean {
  return driver.position >= min && driver.position <= max;
}

/**
 * Get driver's teammate
 */
export function getTeammate(
  driver: DriverState,
  snapshot: RaceSnapshot
): DriverState | null {
  return snapshot.drivers.find(
    (d) => d.team === driver.team && d.driverNumber !== driver.driverNumber
  ) ?? null;
}

/**
 * Check if two drivers are on the same team
 */
export function areTeammates(
  driver1: DriverState,
  driver2: DriverState
): boolean {
  return driver1.team === driver2.team;
}

/**
 * Calculate tyre age difference between two drivers
 */
export function getTyreAgeDifference(
  driver1: DriverState,
  driver2: DriverState
): number {
  return Math.abs(driver1.tyreAge - driver2.tyreAge);
}

/**
 * Check if leader's gap is within a threshold
 */
export function isLeaderGapUnder(snapshot: RaceSnapshot, threshold: number): boolean {
  const leader = snapshot.drivers[0];
  if (!leader) return false;

  const second = snapshot.drivers[1];
  if (!second || second.interval === null) return false;

  return second.interval < threshold;
}

/**
 * Calculate derived signals for a race snapshot
 */
export function calculateDerivedSignals(
  currentSnapshot: RaceSnapshot,
  previousSnapshot: RaceSnapshot | null
): DerivedSignals {
  const closingTrend = new Map<number, boolean>();
  const pitWindowOpen = new Map<number, boolean>();
  const tyreCliffRisk = new Map<number, boolean>();
  const undercutWindow = new Map<number, boolean>();
  const energyAdvantage = new Map<number, { attacker: number; defender: number }[]>();
  const closeBattles = getCloseBattles(currentSnapshot, 2.0);
  const recentPitters: number[] = [];

  for (const driver of currentSnapshot.drivers) {
    // Closing trend
    if (previousSnapshot) {
      const prevDriver = previousSnapshot.drivers.find(
        (d) => d.driverNumber === driver.driverNumber
      );
      if (prevDriver && driver.gap !== null && prevDriver.gap !== null) {
        closingTrend.set(
          driver.driverNumber,
          isClosingTrend(driver.gap, prevDriver.gap)
        );
      }
    }

    // Pit window
    pitWindowOpen.set(driver.driverNumber, isInPitWindow(driver));

    // Tyre cliff
    tyreCliffRisk.set(driver.driverNumber, isAtTyreCliff(driver));

    // Undercut window
    undercutWindow.set(driver.driverNumber, isUndercutWindow(driver));

    // Recent pitters (pitted in last 3 laps)
    if (driver.tyreAge <= 3 && driver.pitCount > 0) {
      recentPitters.push(driver.driverNumber);
    }
  }

  // Energy advantage battles
  for (const battle of closeBattles) {
    if (hasEnergyAdvantage(battle.attacker, battle.defender)) {
      const existing = energyAdvantage.get(battle.attacker.driverNumber) || [];
      existing.push({
        attacker: battle.attacker.driverNumber,
        defender: battle.defender.driverNumber,
      });
      energyAdvantage.set(battle.attacker.driverNumber, existing);
    }
  }

  return {
    closingTrend,
    pitWindowOpen,
    tyreCliffRisk,
    undercutWindow,
    energyAdvantage,
    closeBattles: closeBattles.map((b) => ({
      attacker: b.attacker.driverNumber,
      defender: b.defender.driverNumber,
      gap: b.gap,
    })),
    recentPitters,
  };
}

/**
 * Find a driver by position
 */
export function getDriverByPosition(
  snapshot: RaceSnapshot,
  position: number
): DriverState | null {
  return snapshot.drivers.find((d) => d.position === position) ?? null;
}

/**
 * Find a driver by number
 */
export function getDriverByNumber(
  snapshot: RaceSnapshot,
  driverNumber: number
): DriverState | null {
  return snapshot.drivers.find((d) => d.driverNumber === driverNumber) ?? null;
}

/**
 * Get the race leader
 */
export function getLeader(snapshot: RaceSnapshot): DriverState | null {
  return snapshot.drivers[0] ?? null;
}

/**
 * Get driver ahead of a given driver
 */
export function getDriverAhead(
  snapshot: RaceSnapshot,
  driver: DriverState
): DriverState | null {
  if (driver.position <= 1) return null;
  return snapshot.drivers.find((d) => d.position === driver.position - 1) ?? null;
}

/**
 * Get driver behind a given driver
 */
export function getDriverBehind(
  snapshot: RaceSnapshot,
  driver: DriverState
): DriverState | null {
  return snapshot.drivers.find((d) => d.position === driver.position + 1) ?? null;
}

/**
 * Calculate positions gained/lost since a previous snapshot
 */
export function getPositionChange(
  current: DriverState,
  previous: DriverState
): number {
  return previous.position - current.position; // Positive = gained positions
}