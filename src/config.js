import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

loadDotEnv();

export const config = {
  port: Number(process.env.PORT || 3000),
  line: {
    channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN || "",
    channelSecret: process.env.LINE_CHANNEL_SECRET || ""
  },
  openRouter: {
    apiKey: process.env.OPENROUTER_API_KEY || "",
    model: process.env.OPENROUTER_MODEL || "openrouter/free",
    siteUrl: process.env.OPENROUTER_SITE_URL || "",
    appName: process.env.OPENROUTER_APP_NAME || "LINE OA IT Support"
  },
  supportTeamContact:
    process.env.SUPPORT_TEAM_CONTACT ||
    "ติดต่อ IT Support พร้อม screenshot, ชื่อผู้ใช้, อุปกรณ์ และเวลาที่พบปัญหา",
  maxAiWaitMs: Number(process.env.MAX_AI_WAIT_MS || 45000)
};

function loadDotEnv() {
  const envPath = resolve(process.cwd(), ".env");
  if (!existsSync(envPath)) return;

  const lines = readFileSync(envPath, "utf8").split(/\r?\n/);

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex === -1) continue;

    const key = trimmed.slice(0, separatorIndex).trim();
    const value = trimmed.slice(separatorIndex + 1).trim().replace(/^["']|["']$/g, "");

    if (key && process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

export function validateConfig() {
  const missing = [];

  if (!config.line.channelAccessToken) missing.push("LINE_CHANNEL_ACCESS_TOKEN");
  if (!config.line.channelSecret) missing.push("LINE_CHANNEL_SECRET");
  if (!config.openRouter.apiKey) missing.push("OPENROUTER_API_KEY");

  return missing;
}
