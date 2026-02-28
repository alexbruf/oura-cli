# oura-cli

A simple CLI for the [Oura Ring API v2](https://cloud.ouraring.com/v2/docs). Built with Bun, compiles to a standalone binary. Designed for AI agents — every command has descriptive output in plain text.

## Quick Start

```bash
bun install
```

### Authentication

**Option 1: OAuth2 (recommended)**

Register an app at [cloud.ouraring.com/oauth/applications](https://cloud.ouraring.com/oauth/applications), then:

```bash
export OURA_CLIENT_ID=your_client_id
export OURA_CLIENT_SECRET=your_client_secret
oura login
```

This opens your browser for authorization. Tokens are saved locally and auto-refresh when expired.

**Option 2: Personal access token (legacy)**

```bash
export OURA_ACCESS_TOKEN=your_token
```

Get your token at https://cloud.ouraring.com/personal-access-tokens

### Run

```bash
bun run src/index.ts help
```

## Build Binary

```bash
bun run build
./oura help
```

## Examples

```bash
# Log in via OAuth2
oura login

# Last 7 days of sleep scores
oura daily-sleep

# Specific date range
oura daily-activity --start-date 2025-01-01 --end-date 2025-01-07

# Heart rate (uses datetime)
oura heart-rate --start-datetime 2025-01-15T08:00:00 --end-datetime 2025-01-15T22:00:00

# Personal info
oura personal-info

# Log out (delete stored tokens)
oura logout
```

## Environment

| Variable | Required | Description |
|---|---|---|
| `OURA_CLIENT_ID` | For OAuth2 | Your OAuth2 app client ID |
| `OURA_CLIENT_SECRET` | For OAuth2 | Your OAuth2 app client secret |
| `OURA_ACCESS_TOKEN` | Alternative | Personal access token (legacy) |

Authentication priority: `OURA_ACCESS_TOKEN` env var > stored OAuth2 tokens (`~/.oura-cli/tokens.json`).
