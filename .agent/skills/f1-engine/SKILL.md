---
name: f1-engine-logic
description: Core F1 race logic and question engine rules for Motorsport IQ. Triggers when working on backend/src/engine, question generation, or race data processing.
metadata:
  version: "1.0.0"
  author: "Antigravity + Motorsport IQ"
---

# 🏎️ F1 Engine Logic Skill

This skill governs the server-authoritative race logic for Motorsport IQ. Use it to ensure all race data, question triggers, and scoring resolutions are consistent.

## 🏁 Core Principles
- **Server-Authoritative**: All game state and scoring must be calculated on the server.
- **Lap-Based Resolution**: Questions only resolve upon lap completion (OpenF1 integration).
- **Time-Sensitive**: Answers have a strict 20-second window.

## 📂 Instruction Index
- [Race Lifecycle & Safety Cars](rules/race-lifecycle.md) - How to handle SC, VSC, and Red Flags.
- [Question Triggers & Signals](rules/triggers.md) - Rules for `closingTrend`, `pitWindowOpen`, etc.
- [Scoring & Penalties](rules/scoring.md) - Scoring system and streak bonuses.

## 🛠️ Automated Scripts
- To test the question engine logic with mock data, run: `npm run test:engine` (configured in `backend/`).
