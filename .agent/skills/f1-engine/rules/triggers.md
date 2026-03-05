# 🎯 Question Triggers & F1 Data Signals

## 📐 Priority Hierarchy
When multiple question types are eligible, always trigger the highest priority:
1.  **PIT** (Highest)
2.  **STRATEGY**
3.  **OVERTAKE**
4.  **ENERGY_BATTLE**
5.  **GAP_CLOSING**
6.  **FINISH_POSITION** (Lowest)

## 📊 Derived Signals (Trigger Conditions)
These functions in `backend/src/engine/derivedSignals.ts` define how data becomes a question:

- **closingTrend**: Gap between two drivers (Attacker and Defender) is decreasing by > 0.1s per lap.
- **pitWindowOpen**: `tyreAge` >= 15 laps AND driver has fewer stops than the current front-runner.
- **tyreCliffRisk**: `tyreAge` >= 25 laps.
- **undercutWindow**: Gap between two drivers is < 3.0s AND `pitWindowOpen` is true for the trailing driver.
- **energyAdvantage**: DRS active on the attacker but NOT on the defender (OpenF1 `drsEnabled`).

## 🚫 Engine Constraints
- **MAX Questions**: 10 questions per race, per lobby.
- **Concurrency**: ONLY ONE active question per lobby at any given time.
- **Time Window**: 20 seconds total for users to answer. (Server-side timer is absolute).
