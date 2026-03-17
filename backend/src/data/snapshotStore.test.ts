import type { OpenF1Driver, OpenF1Lap, OpenF1RaceControl } from '../types';
import { SnapshotStore } from './snapshotStore';

function createDriver(overrides: Partial<OpenF1Driver> = {}): OpenF1Driver {
  return {
    driver_number: 1,
    broadcast_name: 'VER',
    full_name: 'Max Verstappen',
    name_acronym: 'VER',
    team_name: 'Red Bull',
    team_colour: '3671C6',
    first_name: 'Max',
    last_name: 'Verstappen',
    headshot_url: '',
    country_code: 'NLD',
    session_key: 1001,
    meeting_key: 2001,
    ...overrides,
  };
}

function createLap(overrides: Partial<OpenF1Lap> = {}): OpenF1Lap {
  return {
    session_key: 1001,
    meeting_key: 2001,
    driver_number: 1,
    lap_number: 1,
    lap_duration: 90,
    lap_time: null,
    is_pit_out_lap: false,
    date_start: '2025-09-01T13:00:00Z',
    duration_sector_1: null,
    duration_sector_2: null,
    duration_sector_3: null,
    segments_sector_1: [],
    segments_sector_2: [],
    segments_sector_3: [],
    ...overrides,
  };
}

function createRaceControl(overrides: Partial<OpenF1RaceControl> = {}): OpenF1RaceControl {
  return {
    date: '2025-09-01T13:05:00Z',
    session_key: 1001,
    meeting_key: 2001,
    category: 'Flag',
    flag: 'YELLOW',
    scope: 'Track',
    sector: 0,
    driver_number: 0,
    message: 'YELLOW FLAG',
    lap_number: 1,
    ...overrides,
  };
}

describe('SnapshotStore race control updates', () => {
  it('rebuilds and emits the snapshot immediately when track status changes', async () => {
    const onSnapshotUpdate = jest.fn();
    const parseTrackStatus = jest.fn(() => 'YELLOW' as const);
    const client = {
      getDrivers: jest.fn(async () => [createDriver()]),
      parseTrackStatus,
    } as any;

    const store = new SnapshotStore(client, { onSnapshotUpdate });
    await store.initialize(1001, { sessionMode: 'replay', replaySpeed: 10 });
    store.processLapCompletion(createLap());

    onSnapshotUpdate.mockClear();
    store.processRaceControlUpdate([createRaceControl()]);

    expect(parseTrackStatus).toHaveBeenCalledWith([createRaceControl()]);
    expect(onSnapshotUpdate).toHaveBeenCalledTimes(1);
    expect(store.getCurrentSnapshot()?.trackStatus).toBe('YELLOW');
  });
});
