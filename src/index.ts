#!/usr/bin/env bun

import { join } from "path";
import { homedir } from "os";

const API_BASE = "https://api.ouraring.com/v2/usercollection";
const OAUTH_AUTHORIZE_URL = "https://cloud.ouraring.com/oauth/authorize";
const OAUTH_TOKEN_URL = "https://api.ouraring.com/oauth/token";
const OAUTH_SCOPES = "email personal daily heartrate workout tag session spo2";
const CALLBACK_PORT = 8787;
const TOKEN_DIR = join(homedir(), ".oura-cli");
const TOKEN_FILE = join(TOKEN_DIR, "tokens.json");

// ── Token Storage ─────────────────────────────────────────────────────

interface StoredTokens {
  access_token: string;
  refresh_token: string;
  expires_at: number; // unix timestamp in ms
}

async function loadStoredTokens(): Promise<StoredTokens | null> {
  try {
    const file = Bun.file(TOKEN_FILE);
    if (!(await file.exists())) return null;
    return await file.json();
  } catch {
    return null;
  }
}

async function saveTokens(tokens: StoredTokens): Promise<void> {
  const { mkdirSync } = await import("fs");
  mkdirSync(TOKEN_DIR, { recursive: true });
  await Bun.write(TOKEN_FILE, JSON.stringify(tokens, null, 2));
}

async function deleteTokens(): Promise<void> {
  const { unlinkSync } = await import("fs");
  try {
    unlinkSync(TOKEN_FILE);
  } catch {
    // file didn't exist, that's fine
  }
}

async function refreshAccessToken(refreshToken: string): Promise<StoredTokens> {
  const clientId = process.env.OURA_CLIENT_ID;
  const clientSecret = process.env.OURA_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    console.error("Error: OURA_CLIENT_ID and OURA_CLIENT_SECRET are required to refresh tokens.");
    console.error("Set them or run 'oura login' again.");
    process.exit(1);
  }

  const res = await fetch(OAUTH_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    console.error(`Token refresh failed (${res.status}): ${body}`);
    console.error("Run 'oura login' to re-authenticate.");
    process.exit(1);
  }

  const data = await res.json();
  const stored: StoredTokens = {
    access_token: data.access_token,
    refresh_token: data.refresh_token ?? refreshToken,
    expires_at: Date.now() + data.expires_in * 1000,
  };
  await saveTokens(stored);
  return stored;
}

async function getToken(): Promise<string> {
  // 1. Check env var first
  const envToken = process.env.OURA_ACCESS_TOKEN;
  if (envToken) return envToken;

  // 2. Check stored OAuth2 tokens
  const stored = await loadStoredTokens();
  if (stored) {
    // Auto-refresh if expired (with 60s buffer)
    if (Date.now() >= stored.expires_at - 60_000) {
      const refreshed = await refreshAccessToken(stored.refresh_token);
      return refreshed.access_token;
    }
    return stored.access_token;
  }

  throw new Error(
    "No authentication found.\nEither set OURA_ACCESS_TOKEN or run 'oura login' for OAuth2."
  );
}

// ── Types ──────────────────────────────────────────────────────────────

interface Command {
  description: string;
  endpoint: string;
  dateParam: "date" | "datetime" | "none";
  format: (data: any) => string;
}

// ── Formatters ─────────────────────────────────────────────────────────

function formatDate(d: string): string {
  return d || "N/A";
}

function formatScore(score: number | null | undefined): string {
  if (score == null) return "N/A";
  return `${score}/100`;
}

function formatMinutes(mins: number | null | undefined): string {
  if (mins == null) return "N/A";
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function formatSeconds(secs: number | null | undefined): string {
  if (secs == null) return "N/A";
  return formatMinutes(Math.round(secs / 60));
}

function formatPersonalInfo(data: any): string {
  const d = data;
  const lines = [
    "── Personal Info ──",
    `  Age:    ${d.age ?? "N/A"}`,
    `  Weight: ${d.weight ? d.weight + " kg" : "N/A"}`,
    `  Height: ${d.height ? d.height + " m" : "N/A"}`,
    `  Sex:    ${d.biological_sex ?? "N/A"}`,
    `  Email:  ${d.email ?? "N/A"}`,
  ];
  return lines.join("\n");
}

function formatDailyActivity(items: any[]): string {
  if (!items.length) return "No activity data found for this period.";
  return items
    .map((d) => {
      return [
        `── Activity: ${formatDate(d.day)} ──`,
        `  Score:             ${formatScore(d.score)}`,
        `  Active Calories:   ${d.active_calories ?? "N/A"} kcal`,
        `  Total Calories:    ${d.total_calories ?? "N/A"} kcal`,
        `  Steps:             ${d.steps?.toLocaleString() ?? "N/A"}`,
        `  Equivalent Walking Distance: ${d.equivalent_walking_distance ? Math.round(d.equivalent_walking_distance) + " m" : "N/A"}`,
        `  High Activity:     ${formatMinutes(d.high_activity_time ? Math.round(d.high_activity_time / 60) : null)}`,
        `  Medium Activity:   ${formatMinutes(d.medium_activity_time ? Math.round(d.medium_activity_time / 60) : null)}`,
        `  Low Activity:      ${formatMinutes(d.low_activity_time ? Math.round(d.low_activity_time / 60) : null)}`,
        `  Sedentary Time:    ${formatMinutes(d.sedentary_time ? Math.round(d.sedentary_time / 60) : null)}`,
        `  Resting Time:      ${formatMinutes(d.resting_time ? Math.round(d.resting_time / 60) : null)}`,
        `  MET Minutes:       ${d.met?.average_met ? d.met.average_met.toFixed(1) : "N/A"}`,
      ].join("\n");
    })
    .join("\n\n");
}

function formatDailyReadiness(items: any[]): string {
  if (!items.length) return "No readiness data found for this period.";
  return items
    .map((d) => {
      const c = d.contributors || {};
      return [
        `── Readiness: ${formatDate(d.day)} ──`,
        `  Score:                    ${formatScore(d.score)}`,
        `  Temperature Deviation:    ${d.temperature_deviation != null ? d.temperature_deviation.toFixed(2) + "°C" : "N/A"}`,
        `  Temperature Trend:        ${d.temperature_trend_deviation != null ? d.temperature_trend_deviation.toFixed(2) + "°C" : "N/A"}`,
        `  Contributors:`,
        `    Activity Balance:       ${formatScore(c.activity_balance)}`,
        `    Body Temperature:       ${formatScore(c.body_temperature)}`,
        `    HRV Balance:            ${formatScore(c.hrv_balance)}`,
        `    Previous Day Activity:  ${formatScore(c.previous_day_activity)}`,
        `    Previous Night:         ${formatScore(c.previous_night)}`,
        `    Recovery Index:         ${formatScore(c.recovery_index)}`,
        `    Resting Heart Rate:     ${formatScore(c.resting_heart_rate)}`,
        `    Sleep Balance:          ${formatScore(c.sleep_balance)}`,
      ].join("\n");
    })
    .join("\n\n");
}

function formatDailySleep(items: any[]): string {
  if (!items.length) return "No daily sleep data found for this period.";
  return items
    .map((d) => {
      const c = d.contributors || {};
      return [
        `── Daily Sleep: ${formatDate(d.day)} ──`,
        `  Score:           ${formatScore(d.score)}`,
        `  Contributors:`,
        `    Deep Sleep:    ${formatScore(c.deep_sleep)}`,
        `    Efficiency:    ${formatScore(c.efficiency)}`,
        `    Latency:       ${formatScore(c.latency)}`,
        `    REM Sleep:     ${formatScore(c.rem_sleep)}`,
        `    Restfulness:   ${formatScore(c.restfulness)}`,
        `    Timing:        ${formatScore(c.timing)}`,
        `    Total Sleep:   ${formatScore(c.total_sleep)}`,
      ].join("\n");
    })
    .join("\n\n");
}

function formatSleep(items: any[]): string {
  if (!items.length) return "No sleep period data found for this period.";
  return items
    .map((d) => {
      return [
        `── Sleep Period: ${formatDate(d.day)} ──`,
        `  Type:            ${d.type ?? "N/A"}`,
        `  Bedtime Start:   ${d.bedtime_start ?? "N/A"}`,
        `  Bedtime End:     ${d.bedtime_end ?? "N/A"}`,
        `  Total Duration:  ${formatSeconds(d.total_sleep_duration)}`,
        `  Time in Bed:     ${formatSeconds(d.time_in_bed)}`,
        `  Deep Sleep:      ${formatSeconds(d.deep_sleep_duration)}`,
        `  REM Sleep:       ${formatSeconds(d.rem_sleep_duration)}`,
        `  Light Sleep:     ${formatSeconds(d.light_sleep_duration)}`,
        `  Awake Time:      ${formatSeconds(d.awake_time)}`,
        `  Efficiency:      ${d.efficiency != null ? d.efficiency + "%" : "N/A"}`,
        `  Latency:         ${formatSeconds(d.latency)}`,
        `  Avg Heart Rate:  ${d.average_heart_rate != null ? d.average_heart_rate.toFixed(1) + " bpm" : "N/A"}`,
        `  Lowest HR:       ${d.lowest_heart_rate != null ? d.lowest_heart_rate + " bpm" : "N/A"}`,
        `  Avg HRV (RMSSD): ${d.average_hrv != null ? Math.round(d.average_hrv) + " ms" : "N/A"}`,
        `  Restless Periods:${d.restless_periods ?? "N/A"}`,
      ].join("\n");
    })
    .join("\n\n");
}

function formatDailySpo2(items: any[]): string {
  if (!items.length) return "No SpO2 data found for this period.";
  return items
    .map((d) => {
      return [
        `── SpO2: ${formatDate(d.day)} ──`,
        `  Average: ${d.spo2_percentage?.average != null ? d.spo2_percentage.average + "%" : "N/A"}`,
      ].join("\n");
    })
    .join("\n\n");
}

function formatDailyStress(items: any[]): string {
  if (!items.length) return "No stress data found for this period.";
  return items
    .map((d) => {
      return [
        `── Stress: ${formatDate(d.day)} ──`,
        `  Stress High:    ${d.stress_high ?? "N/A"} min`,
        `  Recovery High:  ${d.recovery_high ?? "N/A"} min`,
        `  Day Summary:    ${d.day_summary ?? "N/A"}`,
      ].join("\n");
    })
    .join("\n\n");
}

function formatHeartRate(items: any[]): string {
  if (!items.length) return "No heart rate data found for this period.";
  const lines = ["── Heart Rate ──"];
  // Group by source for readability
  for (const d of items) {
    lines.push(`  ${d.timestamp}  ${d.bpm} bpm  (${d.source ?? "unknown"})`);
  }
  // Summary
  const bpms = items.map((d) => d.bpm).filter((b: number) => b != null);
  if (bpms.length) {
    const min = Math.min(...bpms);
    const max = Math.max(...bpms);
    const avg = (bpms.reduce((a: number, b: number) => a + b, 0) / bpms.length).toFixed(1);
    lines.push("");
    lines.push(`  Summary: ${bpms.length} readings, Min ${min} bpm, Max ${max} bpm, Avg ${avg} bpm`);
  }
  return lines.join("\n");
}

function formatWorkout(items: any[]): string {
  if (!items.length) return "No workout data found for this period.";
  return items
    .map((d) => {
      return [
        `── Workout: ${formatDate(d.day)} ──`,
        `  Activity:   ${d.activity ?? "N/A"}`,
        `  Start:      ${d.start_datetime ?? "N/A"}`,
        `  End:        ${d.end_datetime ?? "N/A"}`,
        `  Duration:   ${formatSeconds(d.duration)}`,
        `  Calories:   ${d.calories != null ? d.calories + " kcal" : "N/A"}`,
        `  Distance:   ${d.distance != null ? (d.distance / 1000).toFixed(2) + " km" : "N/A"}`,
        `  Intensity:  ${d.intensity ?? "N/A"}`,
        `  Source:     ${d.source ?? "N/A"}`,
      ].join("\n");
    })
    .join("\n\n");
}

function formatSession(items: any[]): string {
  if (!items.length) return "No session data found for this period.";
  return items
    .map((d) => {
      return [
        `── Session: ${formatDate(d.day)} ──`,
        `  Type:       ${d.type ?? "N/A"}`,
        `  Mood:       ${d.mood ?? "N/A"}`,
        `  Start:      ${d.start_datetime ?? "N/A"}`,
        `  End:        ${d.end_datetime ?? "N/A"}`,
        `  Avg HR:     ${d.average_heart_rate != null ? d.average_heart_rate + " bpm" : "N/A"}`,
        `  Avg HRV:    ${d.average_hrv != null ? Math.round(d.average_hrv) + " ms" : "N/A"}`,
      ].join("\n");
    })
    .join("\n\n");
}

function formatEnhancedTag(items: any[]): string {
  if (!items.length) return "No tag data found for this period.";
  return items
    .map((d) => {
      return [
        `── Tag: ${formatDate(d.day)} ──`,
        `  Tag:      ${d.tag_type_code ?? "N/A"}`,
        `  Time:     ${d.timestamp ?? "N/A"}`,
        `  Comment:  ${d.comment || "none"}`,
      ].join("\n");
    })
    .join("\n\n");
}

function formatRingConfig(items: any[]): string {
  if (!items.length) return "No ring configuration data found.";
  return items
    .map((d) => {
      return [
        `── Ring Configuration ──`,
        `  Color:            ${d.color ?? "N/A"}`,
        `  Design:           ${d.design ?? "N/A"}`,
        `  Firmware:         ${d.firmware_version ?? "N/A"}`,
        `  Hardware Type:    ${d.hardware_type ?? "N/A"}`,
        `  Set Up Date:      ${d.set_up_at ?? "N/A"}`,
        `  Size:             ${d.size ?? "N/A"}`,
      ].join("\n");
    })
    .join("\n\n");
}

function formatRestMode(items: any[]): string {
  if (!items.length) return "No rest mode data found for this period.";
  return items
    .map((d) => {
      return [
        `── Rest Mode: ${formatDate(d.day ?? d.start_day)} ──`,
        `  Start:    ${d.start_day ?? "N/A"}`,
        `  End:      ${d.end_day ?? "ongoing"}`,
        `  End Date: ${d.end_date ?? "ongoing"}`,
      ].join("\n");
    })
    .join("\n\n");
}

function formatSleepTime(items: any[]): string {
  if (!items.length) return "No sleep time recommendation data found for this period.";
  return items
    .map((d) => {
      return [
        `── Sleep Time: ${formatDate(d.day)} ──`,
        `  Optimal Bedtime:`,
        `    Start:  ${d.recommendation?.optimal_bedtime?.start ?? "N/A"}`,
        `    End:    ${d.recommendation?.optimal_bedtime?.end ?? "N/A"}`,
        `  Status:   ${d.status ?? "N/A"}`,
      ].join("\n");
    })
    .join("\n\n");
}

function formatDailyCardiovascularAge(items: any[]): string {
  if (!items.length) return "No cardiovascular age data found for this period.";
  return items
    .map((d) => {
      return [
        `── Cardiovascular Age: ${formatDate(d.day)} ──`,
        `  Vascular Age: ${d.vascular_age ?? "N/A"}`,
      ].join("\n");
    })
    .join("\n\n");
}

function formatDailyResilience(items: any[]): string {
  if (!items.length) return "No resilience data found for this period.";
  return items
    .map((d) => {
      const c = d.contributors || {};
      return [
        `── Resilience: ${formatDate(d.day)} ──`,
        `  Level:                ${d.level ?? "N/A"}`,
        `  Contributors:`,
        `    Sleep Recovery:     ${formatScore(c.sleep_recovery)}`,
        `    Daytime Recovery:   ${formatScore(c.daytime_recovery)}`,
        `    Stress:             ${formatScore(c.stress)}`,
      ].join("\n");
    })
    .join("\n\n");
}

function formatVo2Max(items: any[]): string {
  if (!items.length) return "No VO2 max data found for this period.";
  return items
    .map((d) => {
      return [
        `── VO2 Max: ${formatDate(d.day)} ──`,
        `  VO2 Max: ${d.vo2_max != null ? d.vo2_max.toFixed(1) + " mL/kg/min" : "N/A"}`,
      ].join("\n");
    })
    .join("\n\n");
}

function formatList(data: any, formatter: (items: any[]) => string): string {
  const items = data?.data ?? [];
  const result = formatter(items);
  const next = data?.next_token;
  if (next) {
    return result + `\n\n(More data available — use --next-token ${next})`;
  }
  return result;
}

// ── Commands ───────────────────────────────────────────────────────────

const COMMANDS: Record<string, Command> = {
  "personal-info": {
    description: "Get your personal info (age, weight, height, sex, email)",
    endpoint: "/personal_info",
    dateParam: "none",
    format: (data) => formatPersonalInfo(data),
  },
  "daily-activity": {
    description: "Get daily activity scores, calories, steps, and movement data",
    endpoint: "/daily_activity",
    dateParam: "date",
    format: (data) => formatList(data, formatDailyActivity),
  },
  "daily-readiness": {
    description: "Get daily readiness scores and contributor breakdowns",
    endpoint: "/daily_readiness",
    dateParam: "date",
    format: (data) => formatList(data, formatDailyReadiness),
  },
  "daily-sleep": {
    description: "Get daily sleep scores and contributor breakdowns",
    endpoint: "/daily_sleep",
    dateParam: "date",
    format: (data) => formatList(data, formatDailySleep),
  },
  sleep: {
    description: "Get detailed sleep period data (durations, HR, HRV, stages)",
    endpoint: "/sleep",
    dateParam: "date",
    format: (data) => formatList(data, formatSleep),
  },
  "daily-spo2": {
    description: "Get daily blood oxygen (SpO2) averages",
    endpoint: "/daily_spo2",
    dateParam: "date",
    format: (data) => formatList(data, formatDailySpo2),
  },
  "daily-stress": {
    description: "Get daily stress and recovery minutes",
    endpoint: "/daily_stress",
    dateParam: "date",
    format: (data) => formatList(data, formatDailyStress),
  },
  "heart-rate": {
    description: "Get 5-minute interval heart rate readings",
    endpoint: "/heartrate",
    dateParam: "datetime",
    format: (data) => formatList(data, formatHeartRate),
  },
  workout: {
    description: "Get workout data (type, duration, calories, distance)",
    endpoint: "/workout",
    dateParam: "date",
    format: (data) => formatList(data, formatWorkout),
  },
  session: {
    description: "Get guided/unguided session data with biometrics",
    endpoint: "/session",
    dateParam: "date",
    format: (data) => formatList(data, formatSession),
  },
  "enhanced-tag": {
    description: "Get lifestyle tags with timestamps and comments",
    endpoint: "/enhanced_tag",
    dateParam: "date",
    format: (data) => formatList(data, formatEnhancedTag),
  },
  "ring-config": {
    description: "Get ring configuration (model, size, firmware, color)",
    endpoint: "/ring_configuration",
    dateParam: "date",
    format: (data) => formatList(data, formatRingConfig),
  },
  "rest-mode": {
    description: "Get rest mode periods",
    endpoint: "/rest_mode_period",
    dateParam: "date",
    format: (data) => formatList(data, formatRestMode),
  },
  "sleep-time": {
    description: "Get optimal bedtime recommendations",
    endpoint: "/sleep_time",
    dateParam: "date",
    format: (data) => formatList(data, formatSleepTime),
  },
  "cardiovascular-age": {
    description: "Get daily cardiovascular age estimate",
    endpoint: "/daily_cardiovascular_age",
    dateParam: "date",
    format: (data) => formatList(data, formatDailyCardiovascularAge),
  },
  "daily-resilience": {
    description: "Get daily resilience level and contributor scores",
    endpoint: "/daily_resilience",
    dateParam: "date",
    format: (data) => formatList(data, formatDailyResilience),
  },
  "vo2-max": {
    description: "Get estimated VO2 max values",
    endpoint: "/vO2_max",
    dateParam: "date",
    format: (data) => formatList(data, formatVo2Max),
  },
};

// ── API ────────────────────────────────────────────────────────────────

async function apiGet(endpoint: string, params: Record<string, string>): Promise<any> {
  const url = new URL(API_BASE + endpoint);
  for (const [k, v] of Object.entries(params)) {
    if (v) url.searchParams.set(k, v);
  }

  const token = await getToken();
  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    const body = await res.text();
    console.error(`API Error ${res.status}: ${body}`);
    process.exit(1);
  }

  return res.json();
}

// ── Argument Parsing ───────────────────────────────────────────────────

function parseArgs(args: string[]): Record<string, string> {
  const result: Record<string, string> = {};
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg.startsWith("--")) {
      const key = arg.slice(2);
      const val = args[i + 1];
      if (val && !val.startsWith("--")) {
        result[key] = val;
        i++;
      } else {
        result[key] = "true";
      }
    }
  }
  return result;
}

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

// ── OAuth2 Login ──────────────────────────────────────────────────────

async function handleLogin(): Promise<void> {
  const clientId = process.env.OURA_CLIENT_ID;
  const clientSecret = process.env.OURA_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    console.error("Error: OURA_CLIENT_ID and OURA_CLIENT_SECRET environment variables are required.");
    console.error("Get them from https://cloud.ouraring.com/oauth/applications");
    console.error("");
    console.error("  export OURA_CLIENT_ID=your_client_id");
    console.error("  export OURA_CLIENT_SECRET=your_client_secret");
    process.exit(1);
  }

  const redirectUri = `http://localhost:${CALLBACK_PORT}/callback`;
  const authUrl = new URL(OAUTH_AUTHORIZE_URL);
  authUrl.searchParams.set("client_id", clientId);
  authUrl.searchParams.set("redirect_uri", redirectUri);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("scope", OAUTH_SCOPES);

  console.log("Opening browser for Oura OAuth2 login...");
  console.log(`If the browser doesn't open, visit:\n  ${authUrl.toString()}\n`);

  // Open browser
  const { spawn } = await import("child_process");
  const openCmd = process.platform === "darwin" ? "open" : process.platform === "win32" ? "start" : "xdg-open";
  spawn(openCmd, [authUrl.toString()], { stdio: "ignore" });

  // Start local server to receive callback
  const { promise, resolve } = Promise.withResolvers<string>();

  const server = Bun.serve({
    port: CALLBACK_PORT,
    async fetch(req) {
      const url = new URL(req.url);
      if (url.pathname === "/callback") {
        const code = url.searchParams.get("code");
        const error = url.searchParams.get("error");

        if (error) {
          resolve("");
          return new Response(
            "<html><body><h2>Authorization denied.</h2><p>You can close this tab.</p></body></html>",
            { headers: { "Content-Type": "text/html" } },
          );
        }

        if (code) {
          resolve(code);
          return new Response(
            "<html><body><h2>Success!</h2><p>You can close this tab and return to the terminal.</p></body></html>",
            { headers: { "Content-Type": "text/html" } },
          );
        }
      }
      return new Response("Not found", { status: 404 });
    },
  });

  console.log(`Waiting for authorization callback on port ${CALLBACK_PORT}...`);
  const code = await promise;
  server.stop();

  if (!code) {
    console.error("Authorization was denied or failed.");
    process.exit(1);
  }

  // Exchange code for tokens
  const tokenRes = await fetch(OAUTH_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
      client_id: clientId,
      client_secret: clientSecret,
    }),
  });

  if (!tokenRes.ok) {
    const body = await tokenRes.text();
    console.error(`Token exchange failed (${tokenRes.status}): ${body}`);
    process.exit(1);
  }

  const tokenData = await tokenRes.json();
  const stored: StoredTokens = {
    access_token: tokenData.access_token,
    refresh_token: tokenData.refresh_token,
    expires_at: Date.now() + tokenData.expires_in * 1000,
  };
  await saveTokens(stored);

  console.log("Logged in successfully! Tokens saved to ~/.oura-cli/tokens.json");
  console.log("You can now use any oura command without setting OURA_ACCESS_TOKEN.");
}

async function handleLogout(): Promise<void> {
  await deleteTokens();
  console.log("Logged out. Stored tokens deleted.");
}

// ── Main ───────────────────────────────────────────────────────────────

function printHelp() {
  console.log("oura — CLI for Oura Ring API v2\n");
  console.log("Usage: oura <command> [options]\n");
  console.log("Auth Commands:");
  console.log("  login                    Authenticate via OAuth2 (opens browser)");
  console.log("  logout                   Remove stored OAuth2 tokens");
  console.log("");
  console.log("Data Commands:");
  const maxLen = Math.max(...Object.keys(COMMANDS).map((k) => k.length));
  for (const [name, cmd] of Object.entries(COMMANDS)) {
    console.log(`  ${name.padEnd(maxLen + 2)} ${cmd.description}`);
  }
  console.log("\nDate Options (for most commands):");
  console.log("  --start-date YYYY-MM-DD    Start date (default: 7 days ago)");
  console.log("  --end-date YYYY-MM-DD      End date (default: today)");
  console.log("\nDatetime Options (for heart-rate):");
  console.log("  --start-datetime YYYY-MM-DDTHH:MM:SS   Start datetime");
  console.log("  --end-datetime YYYY-MM-DDTHH:MM:SS     End datetime");
  console.log("\nPagination:");
  console.log("  --next-token TOKEN         Fetch next page of results");
  console.log("\nAuthentication (in priority order):");
  console.log("  1. OURA_ACCESS_TOKEN env var (legacy personal access token)");
  console.log("  2. OAuth2 tokens via 'oura login' (recommended, auto-refreshes)");
  console.log("\nOAuth2 Setup:");
  console.log("  OURA_CLIENT_ID             Your OAuth2 app client ID");
  console.log("  OURA_CLIENT_SECRET         Your OAuth2 app client secret");
  console.log("  Register at https://cloud.ouraring.com/oauth/applications");
}

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0 || args[0] === "help" || args[0] === "--help" || args[0] === "-h") {
    printHelp();
    process.exit(0);
  }

  const commandName = args[0];

  if (commandName === "login") {
    await handleLogin();
    process.exit(0);
  }

  if (commandName === "logout") {
    await handleLogout();
    process.exit(0);
  }

  const command = COMMANDS[commandName];

  if (!command) {
    console.error(`Unknown command: ${commandName}`);
    console.error(`Run 'oura help' to see available commands.`);
    process.exit(1);
  }

  const opts = parseArgs(args.slice(1));
  const params: Record<string, string> = {};

  if (command.dateParam === "date") {
    params.start_date = opts["start-date"] ?? daysAgo(7);
    params.end_date = opts["end-date"] ?? todayStr();
  } else if (command.dateParam === "datetime") {
    if (opts["start-datetime"]) params.start_datetime = opts["start-datetime"];
    else params.start_datetime = daysAgo(1) + "T00:00:00";
    if (opts["end-datetime"]) params.end_datetime = opts["end-datetime"];
    else params.end_datetime = todayStr() + "T23:59:59";
  }

  if (opts["next-token"]) {
    params.next_token = opts["next-token"];
  }

  const data = await apiGet(command.endpoint, params);
  console.log(command.format(data));
}

main().catch((err) => {
  console.error(`Error: ${err.message}`);
  process.exit(1);
});
