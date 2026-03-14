---
name: f1-engine-logic
description: Core F1 race logic and MVP question engine rules for Motorsport IQ. Triggers when working on backend/src/engine, question generation, or race data processing.
metadata:
  version: "1.1.0"
  author: "Antigravity + Motorsport IQ"
---

# 🏎️ F1 Engine Logic Skill

This skill governs the server-authoritative MVP race logic for Motorsport IQ. Use it to keep race data handling, question triggers, AI copy generation, and scoring consistent with the project-level `SKILLS.md`.

## 🏁 Core Principles
- **Server-Authoritative**: All game state and scoring must be calculated on the server.
- **Lap-Based Resolution**: Questions only resolve upon lap completion (OpenF1 integration).
- **Time-Sensitive**: Answers have a strict 20-second window.
- **MVP Categories Only**: Restrict gameplay logic to `OVERTAKE`, `PIT_WINDOW`, `GAP_CLOSING`, and `FINISH_POSITION`.
- **AI Boundary**: Groq/Llama may phrase questions and explanations, but it does not decide trigger eligibility or outcome truth.

## 📂 Instruction Index
- [Race Lifecycle & Safety Cars](rules/race-lifecycle.md) - MVP handling for SC, VSC, Red Flags, and restart cooldown.
- [Question Triggers & Signals](rules/triggers.md) - Observable derived signals and category trigger rules.
- [Scoring & Penalties](rules/scoring.md) - Race-session scoring and leaderboard logic.

## 🛠️ Automated Scripts
- To test the question engine logic with mock data, run: `npm run test:engine` (configured in `backend/`).
