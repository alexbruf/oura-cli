---
name: oura
description: Query Oura Ring health data — sleep, activity, readiness, heart rate, stress, SpO2, workouts, and more. Use when the user asks about their health metrics, biometrics, sleep quality, fitness data, or anything related to their Oura Ring.
allowed-tools: Bash(oura *), Bash(bun run src/index.ts *)
---

You have access to the `oura` CLI for querying Oura Ring API v2 data. All output is human-readable plain text.

## Prerequisites

Authentication is needed. If commands fail with auth errors, tell the user to run:
```bash
oura setup
```
This interactively configures either a Personal Access Token or OAuth2. Config is saved at `~/.config/oura-cli/config.json`.

## Available Commands

All commands default to the last 7 days. Use `--start-date` and `--end-date` to narrow the range.

| Command | What it returns |
|---|---|
| `oura setup` | Configure authentication (interactive) |
| `oura login` | Authenticate via OAuth2 (opens browser) |
| `oura logout` | Remove stored OAuth2 tokens |
| `oura personal-info` | Age, weight, height, sex, email |
| `oura daily-activity --start-date YYYY-MM-DD --end-date YYYY-MM-DD` | Activity score, steps, calories, movement breakdown |
| `oura daily-readiness --start-date YYYY-MM-DD --end-date YYYY-MM-DD` | Readiness score + contributors (HRV, recovery, etc.) |
| `oura daily-sleep --start-date YYYY-MM-DD --end-date YYYY-MM-DD` | Sleep score + contributors (deep, REM, efficiency) |
| `oura sleep --start-date YYYY-MM-DD --end-date YYYY-MM-DD` | Detailed sleep periods: durations, HR, HRV, stages |
| `oura daily-spo2 --start-date YYYY-MM-DD --end-date YYYY-MM-DD` | Blood oxygen (SpO2) averages |
| `oura daily-stress --start-date YYYY-MM-DD --end-date YYYY-MM-DD` | Stress vs recovery minutes |
| `oura heart-rate --start-datetime YYYY-MM-DDTHH:MM:SS --end-datetime YYYY-MM-DDTHH:MM:SS` | 5-min interval heart rate readings (uses datetime, not date) |
| `oura workout --start-date YYYY-MM-DD --end-date YYYY-MM-DD` | Workout type, duration, calories, distance |
| `oura session --start-date YYYY-MM-DD --end-date YYYY-MM-DD` | Guided/unguided sessions with biometrics |
| `oura enhanced-tag --start-date YYYY-MM-DD --end-date YYYY-MM-DD` | Lifestyle tags with timestamps |
| `oura ring-config` | Ring hardware: color, size, firmware |
| `oura rest-mode --start-date YYYY-MM-DD --end-date YYYY-MM-DD` | Rest mode periods |
| `oura sleep-time --start-date YYYY-MM-DD --end-date YYYY-MM-DD` | Optimal bedtime recommendations |
| `oura cardiovascular-age --start-date YYYY-MM-DD --end-date YYYY-MM-DD` | Vascular age estimate |
| `oura daily-resilience --start-date YYYY-MM-DD --end-date YYYY-MM-DD` | Resilience level + contributors |
| `oura vo2-max --start-date YYYY-MM-DD --end-date YYYY-MM-DD` | Estimated VO2 max |

## Usage Patterns

**Single day:**
```bash
oura daily-sleep --start-date 2025-01-15 --end-date 2025-01-15
```

**Date range:**
```bash
oura daily-activity --start-date 2025-01-01 --end-date 2025-01-07
```

**Heart rate (uses datetime, not date):**
```bash
oura heart-rate --start-datetime 2025-01-15T08:00:00 --end-datetime 2025-01-15T22:00:00
```

**Pagination (if more data available):**
```bash
oura daily-activity --next-token abc123
```

## Tips

- If the binary `oura` is not compiled yet, use `bun run src/index.ts` instead
- Combine multiple commands to give holistic health summaries
- For a quick health overview, run: daily-readiness + daily-sleep + daily-activity for the same date
- Heart rate is the only command that uses `--start-datetime`/`--end-datetime` instead of `--start-date`/`--end-date`
- OAuth2 tokens auto-refresh when expired — no manual intervention needed
