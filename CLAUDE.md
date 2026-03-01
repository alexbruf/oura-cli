# oura-cli

CLI for the Oura Ring API v2. Built with Bun, compiles to a standalone binary.

## Setup

```bash
bun install
```

### Authentication

Run the interactive setup:
```bash
oura setup
```

This lets you choose between:
1. **Personal Access Token** — paste your token, saved to config
2. **OAuth2** — enter client ID + secret, then log in via browser

Config is stored at `~/.config/oura-cli/config.json`. OAuth2 tokens auto-refresh.

Env var `OURA_ACCESS_TOKEN` overrides config if set.

## Build

```bash
bun run build          # compile for current platform
bun run build:all      # compile for macOS ARM64 + Linux x64
```

## Usage

```bash
oura <command> [--start-date YYYY-MM-DD] [--end-date YYYY-MM-DD]
```

All commands default to the last 7 days. Heart rate uses `--start-datetime` / `--end-datetime`.

## Commands

- `setup` — configure authentication (interactive)
- `login` — authenticate via OAuth2 (opens browser)
- `logout` — remove stored OAuth2 tokens
- `personal-info` — age, weight, height, sex, email
- `daily-activity` — activity score, steps, calories, movement
- `daily-readiness` — readiness score + contributors
- `daily-sleep` — sleep score + contributors
- `sleep` — detailed sleep periods (HR, HRV, stages, durations)
- `daily-spo2` — blood oxygen averages
- `daily-stress` — stress/recovery minutes
- `heart-rate` — 5-min interval HR readings
- `workout` — workout type, duration, calories, distance
- `session` — guided/unguided sessions
- `enhanced-tag` — lifestyle tags
- `ring-config` — ring hardware details
- `rest-mode` — rest mode periods
- `sleep-time` — optimal bedtime recommendations
- `cardiovascular-age` — vascular age estimate
- `daily-resilience` — resilience level + contributors
- `vo2-max` — estimated VO2 max

## Architecture

Single-file CLI at `src/index.ts`. No dependencies beyond Bun builtins.
All output is human-readable plain text, designed for AI agent consumption.
Config and tokens stored at `~/.config/oura-cli/`.
