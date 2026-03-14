# 🏆 MVP Scoring & Penalties Rules

## ⚖️ Core Point System
These points are awarded by the server upon deterministic resolution:

| Outcome | Points |
| --- | --- |
| **Correct Answer** | +10 points |
| **Wrong Answer** | -5 points |
| **No Answer (Timed Out)** | 0 points |

## 🔥 Streak Bonuses
Streaks are calculated on consecutive correct answers:

- **3 Correct Streaks**: +5 bonus points (One-time award).
- **5+ Correct Streaks**: +10 bonus points for EVERY consecutive correct answer from 5 onwards.

## 📊 Leaderboard Logic
- **Primary Sort**: Total Points (Descending).
- **Secondary Sort**: Accuracy (Correct Answers / Total Answered).
- **Tertiary Sort**: Last Answer Time (Fastest first).

## 🧮 Accuracy Calculation
`accuracy = (correct_answers / (total_answered || 1)) * 100` (%)
- Unanswered questions (0 points) are **NOT** included in the total_answered count for accuracy, only for the "Questions Completed" metric.
