# oura-cli

CLI for the Oura Ring API v2. Built with Bun, compiles to a standalone binary.

## Setup

```bash
bun install
```

### Authentication

**Option 1: OAuth2 (recommended)**
```bash
export OURA_CLIENT_ID=your_client_id
export OURA_CLIENT_SECRET=your_client_secret
oura login
```
This opens a browser for OAuth2 authorization. Tokens are saved to `~/.oura-cli/tokens.json` and auto-refresh when expired.

**Option 2: Personal access token (legacy)**
```bash
export OURA_ACCESS_TOKEN=your_token
```

Token resolution order: `OURA_ACCESS_TOKEN` env var > stored OAuth2 tokens.

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
OAuth2 tokens stored at `~/.oura-cli/tokens.json`.
