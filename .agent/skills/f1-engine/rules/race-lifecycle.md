# 🏎️ Race Lifecycle & Resolution Rules

## 🚥 Resolution Timing
- **Lap-Based**: Questions **only** resolve at the end of a lap.
- **Polling**: OpenF1 API is polled every 10 seconds.
- **Trigger**: A change in `lapNumber` for the leader (or tracked driver) triggers a resolution check.

## 🏁 Race Status Handling (Safety Cars & Flags)
Depending on the track status reported by OpenF1:

| Status | Rule | Action |
| --- | --- | --- |
| **GREEN** | Normal | Carry on with question triggering and resolution. |
| **SC** | Safety Car | **Cancel** questions that haven't reached "LOCK" state. **Pause** questions after "LOCK". |
| **VSC** | Virtual SC | Same rules as Safety Car. |
| **RED** | Red Flag | **Immediate cancellation** of ALL active/live questions. |

## ⏳ Question Lifecycle
1.  **TRIGGERED**: Logic decides a question is relevant.
2.  **LIVE**: Question is broadcast to lobbies.
3.  **LOCKED**: Answer period (20s) has ended. No more answers allowed.
4.  **RESOLVED**: Data for the resolution lap has arrived. Points are awarded.
5.  **EXPLAINED**: AI explanation (Claude API) has been sent to the lobby.
6.  **CLOSED**: Final state.
