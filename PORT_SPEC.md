# Motorsport IQ native port

## Scope

This branch ports the player-facing web flow to SwiftUI while keeping the existing Node/Socket.IO backend authoritative. The first vertical slice is home, lobby, reconnect, live question, answer submission, resolution, and leaderboard.

## Contract rules

- The app never calculates points, outcomes, or race state.
- Socket.IO events are the source of truth for lobby, question, resolution, and leaderboard state.
- Reconnection restores through `reconnect_lobby` and the server's `lobby_state` event.
- The answer timer is display-only and uses the server deadline. The server still accepts or rejects the answer.
- iOS 17 is the minimum target. Swift 6 strict concurrency is enabled.

## Parity checklist

| Web behavior | Native status |
| --- | --- |
| Create lobby | P0 |
| Join lobby | P0 |
| Solo/replay session list | P0 |
| Waiting-room roster and host start | P0 |
| Socket.IO reconnect and state restore | P0 |
| 45-second server-authoritative answer window | P0 |
| Resolution and leaderboard | P0 |
| Race snapshot HUD | P0 |
| Report a problem | P1 |
| Sounds and reduced-motion behavior | Done: bundled question/correct/wrong SFX plus toggle |
| Background push notifications | P1, requires APNs approval and provisioning |
| Admin dashboard and arcade | Out of v1 |

## Verification gates

1. Unit-test deadline display and representative payload decoding.
2. Build and run on an iOS simulator.
3. Replay a solo session through question, answer, resolution, and final standings.
4. Verify reconnect by killing and relaunching the simulator app while a lobby is active.
5. Keep signing, APNs, TestFlight, and remote deployment as human approval gates.

## Local run

```bash
cd /Users/shuknuk/Developer/motorsport-iq-ios
xcodegen generate
xcodebuild -project MotorsportIQ.xcodeproj -scheme MotorsportIQ -destination 'platform=iOS Simulator,name=iPhone 14,OS=27.0' build
```

The default `SOCKET_URL` is `http://localhost:4000`. Override the Xcode build setting for a deployed backend, using an `https://` URL in production. Start the existing backend separately with `cd /Users/shuknuk/Developer/motorsport-iq/backend && npm run dev`.
