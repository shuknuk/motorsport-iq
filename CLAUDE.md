# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Motorsport IQ is a real-time Formula 1 prediction game where users join private lobbies, receive live race prediction questions triggered by OpenF1 race data, answer within 20 seconds, and compete on a live leaderboard.

## Tech Stack

- **Frontend**: Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS v4, Socket.io-client
- **Backend**: Node.js, Express, Socket.io, TypeScript
- **Database**: Supabase (PostgreSQL)
- **AI**: Groq API (Llama 3.3) for question explanations
- **Data Source**: OpenF1 API (real-time race telemetry)
- **Deployment**: Railway (backend), Vercel (frontend)

## Development Commands

### Frontend (Port 3000)
```bash
cd frontend
npm install
npm run dev        # Start development server
npm run build      # Production build
npm run lint       # Run ESLint
```

### Backend (Port 4000)
```bash
cd backend
npm install
npm run dev        # Start with nodemon (auto-reload)
npm run build      # Compile TypeScript
npm run start      # Run compiled server
npm run test       # Run all Jest tests
npm run test -- src/engine/questionEngine.test.ts   # Run single test file
npm run lint       # Run ESLint
```

### Testing
- Tests use Jest with ts-jest preset
- Test files: `**/*.test.ts` alongside source files
- Key test files:
  - `backend/src/engine/questionEngine.test.ts` - Question triggering logic
  - `backend/src/engine/scoringEngine.test.ts` - Score calculation
  - `backend/src/lobby/presenceManager.test.ts` - User presence/timeout
  - `backend/src/runtime/sessionRuntimeManager.test.ts` - Session management

### Deployment
```bash
# Railway (backend) - auto-deploys on git push
cd backend && railway deploy

# Vercel (frontend)
vercel --prod
```

## Architecture Overview

### Backend Structure (`backend/src/`)

**Core Modules:**

1. **`server.ts`** - Express + Socket.io entry point
   - Socket event handlers for lobby lifecycle
   - Race snapshot broadcasting
   - Question trigger coordination

2. **`engine/`** - Game logic (server-authoritative)
   - `questionEngine.ts` - Question selection/eligibility
   - `questionBank.ts` - Question templates
   - `resolutionEngine.ts` - Outcome determination
   - `scoringEngine.ts` - Points calculation
   - `derivedSignals.ts` - Race state analysis (closing trends, pit windows, etc.)

3. **`lobby/`** - Room and state management
   - `lobbyManager.ts` - CRUD operations, in-memory caching
   - `lifecycleManager.ts` - Question state machine (TRIGGERED → LIVE → LOCKED → ACTIVE → RESOLVED)
   - `presenceManager.ts` - User connection tracking and timeouts
   - `questionPayload.ts` - Event payload builders

4. **`runtime/`** - Session execution
   - `sessionRuntimeManager.ts` - Live vs Replay mode coordination
   - `replayTimeline.ts` - Replay playback control

5. **`data/`** - External integrations
   - `openf1Client.ts` - OpenF1 API client
   - `snapshotStore.ts` - Race state persistence

6. **`ai/`** - AI generation
   - `explanationGenerator.ts` - Groq-powered question explanations
   - `statHintGenerator.ts` - Telemetry hint suggestions

7. **`admin/`** - Admin panel
   - `auth.ts` - Password-based session auth
   - `reporting.ts` - Problem report management

### Frontend Structure (`frontend/src/`)

**App Router (`app/`):**
- `page.tsx` - Landing page
- `lobby/[code]/page.tsx` - Lobby waiting room
- `game/[code]/page.tsx` - Main game UI
- `admin/page.tsx` - Admin dashboard

**Components (`components/`):**
- `QuestionCard.tsx` - Question display and answer buttons
- `Leaderboard.tsx` - Live standings
- `LapProgressBar.tsx` - Race progress visualization
- `TireStats.tsx` - Driver telemetry display
- `CountdownTimer.tsx` - Answer window timer
- `ui/` - Design system components

**State Management (`lib/`):**
- `socket.ts` - Socket.io client singleton
- `types.ts` - Shared TypeScript types (mirrors backend)
- `backendUrl.ts` - Environment-based URL resolution

### Socket.io Events

**Server → Client:**
- `lobby_state` - Full lobby state sync
- `question_event` - New question triggered
- `question_text_update` - AI-generated text update
- `question_locked` - Answer window closed
- `resolution_event` - Question resolved with explanation
- `leaderboard_update` - Score updates
- `race_snapshot_update` - Live race telemetry
- `presence_expired` - User kicked due to inactivity

**Client → Server:**
- `create_lobby`, `join_lobby`, `leave_lobby`
- `start_session` - Begin race (host only)
- `submit_answer` - YES/NO answer
- `presence_ping` - Activity heartbeat
- `reconnect_lobby` - Rejoin after disconnect

### Race Data Flow

1. OpenF1 API provides lap-level race data
2. `OpenF1Client` builds `RaceSnapshot` on each lap completion
3. `SessionRuntimeManager` distributes snapshots to active lobbies
4. `QuestionEngine` evaluates trigger conditions
5. Selected questions broadcast to clients
6. Resolution happens on subsequent lap data

### Question Lifecycle

```
TRIGGERED (1s) → LIVE (20s) → LOCKED → ACTIVE → RESOLVED → EXPLAINED
```

- **TRIGGERED**: Question created, AI generating text
- **LIVE**: Answer window open (20 seconds)
- **LOCKED**: No more answers accepted
- **ACTIVE**: Awaiting resolution data
- **RESOLVED**: Outcome determined, scores updated

### Key Business Rules

**Engine Guardrails:**
- One active question per lobby at a time
- Maximum 8-10 questions per race
- No questions on laps 1-3
- No triggers during SC/VSC/RED flags
- 1-lap cooldown after restarts
- 2-lap cooldown after question resolution
- No consecutive same-category questions

**Question Categories:**
- `OVERTAKE` - Will driver A overtake driver B?
- `PIT_WINDOW` - Will driver pit in next 3 laps?
- `GAP_CLOSING` - Will gap reduce by 1 second?
- `FINISH_POSITION` - Will driver finish ahead?

**Server Authority:**
- All scores calculated server-side
- All resolutions determined by race data
- Client NEVER calculates scores or outcomes

### Environment Variables

**Backend (`.env` or Railway):**
- `SUPABASE_URL` / `SUPABASE_SERVICE_KEY`
- `GROQ_API_KEY` - AI explanations
- `CORS_ORIGIN` - Comma-separated allowed origins
- `PRESENCE_DISCONNECT_GRACE_MS` - Timeout (default: 2 min)
- `ADMIN_SESSION_SECRET` / `ADMIN_INITIAL_PASSWORD_HASH`

**Frontend (`.env.local`):**
- `NEXT_PUBLIC_SOCKET_URL` - Backend URL
- `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY`

### Database Schema (Supabase)

Key tables: `lobbies`, `users`, `leaderboard`, `questions`, `answers`, `problem_reports`

See `backend/schema/` for full SQL definitions.

### User Preferences

- When asked to "push to git" or "commit and push", also redeploy the backend service to Railway
- Use Railway MCP or CLI for backend deployments
- Use Vercel CLI for frontend deployments

### Performance Considerations

- AI question generation is async (fallback text shown first, updated when AI completes)
- Race snapshots cached in-memory via `lobbyStates` Map
- Presence sweep interval: 60 seconds
- GROQ API latency: 2-4 seconds (non-blocking)

### Important Files Reference

- `backend/src/types.ts` - Shared TypeScript definitions
- `frontend/src/lib/types.ts` - Frontend type mirror
- `backend/src/engine/questionBank.ts` - Question templates
- `SKILLS.md` - Game mechanics rules
- `AGENTS.md` - Quick project reference
