# Motorsport IQ (MSP) — Project Context

## 🌟 Overview
Real-time Formula 1 prediction companion web app. Users join private lobbies, receive live race prediction questions triggered by OpenF1 race data, answer within 20 seconds, and compete on a live leaderboard.

## 💻 Tech Stack
- **Frontend**: Next.js 14 (App Router), TypeScript, Tailwind CSS, Socket.io-client.
- **Backend**: Node.js/Express, Socket.io, Supabase (PostgreSQL).
- **AI**: Anthropic Claude API (Explanations).
- **Data**: OpenF1 API (Real-time race telemetry).

## 🏎️ Specialized Logic (Antigravity Skill)
Detailed race mechanics, question triggering, and scoring rules are managed by the **`f1-engine-logic`** skill located in `.agent/skills/f1-engine/`.
- Refer to `rules/race-lifecycle.md` for SC/VSC handling.
- Refer to `rules/triggers.md` for `closingTrend` and `pitWindow` signals.
- Refer to `rules/scoring.md` for points and streak bonuses.

## 📂 Project Structure
```
motorsport-iq/
├── frontend/                 # Next.js 14 app
├── backend/                  # Node.js + Express + Socket.io
│   ├── src/engine/          # Core game logic (refer to Skill)
│   ├── src/lobby/           # Room & State management
│   └── src/data/            # OpenF1 integration
└── .agent/skills/           # Antigravity Skills
```

## 📡 Socket.io Events
- **Server → Client**: `lobby_state`, `question_event`, `question_locked`, `resolution_event`, `leaderboard_update`.
- **Client → Server**: `join_lobby`, `create_lobby`, `submit_answer`, `start_session`.

## ⚙️ Environment Variables
Refer to `.env.example` in `backend/` and `frontend/` for:
- `SUPABASE_URL`, `ANTHROPIC_API_KEY`, `OPENF1_BASE_URL`, `NEXT_PUBLIC_SOCKET_URL`.

## 🚀 Common Commands
```bash
# Frontend
cd frontend && npm run dev

# Backend
cd backend && npm run dev
cd backend && npm run test     # Run race engine tests
```

## 📝 Important Notes
- Always use `npm`.
- Server-authoritative logic (Client NEVER calculates scores).
- Resolution only on lap completion.
- Reconnection must restore state via `lobby_state`.