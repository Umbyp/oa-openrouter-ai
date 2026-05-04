import http from "node:http";
import { config, validateConfig } from "./config.js";
import { findFaqHints } from "./faq.js";
import { verifyLineSignature, replyText } from "./line.js";
import { askOpenRouter, fallbackAnswer } from "./openrouter.js";

const missingConfig = validateConfig();
if (missingConfig.length) {
  console.warn(`Missing environment variables: ${missingConfig.join(", ")}`);
}

const server = http.createServer(async (req, res) => {
  try {
    if (req.method === "GET" && req.url === "/health") {
      return sendJson(res, 200, { ok: true });
    }

    if (req.method === "POST" && req.url === "/webhook/line") {
      return await handleLineWebhook(req, res);
    }

    sendJson(res, 404, { error: "not_found" });
  } catch (error) {
    console.error(error);
    sendJson(res, 500, { error: "internal_error" });
  }
});

server.listen(config.port, () => {
  console.log(`LINE OA IT Support bot listening on port ${config.port}`);
});

async function handleLineWebhook(req, res) {
  const rawBody = await readRawBody(req);
  const signature = req.headers["x-line-signature"];

  if (!verifyLineSignature(rawBody, signature)) {
    return sendJson(res, 401, { error: "invalid_signature" });
  }

  const payload = JSON.parse(rawBody.toString("utf8"));

  // Reply work starts before returning 200 so the one-time replyToken is used in time.
  await Promise.allSettled(payload.events.map(handleLineEvent));

  sendJson(res, 200, { ok: true });
}

async function handleLineEvent(event) {
  if (!event.replyToken) return;

  if (event.type === "follow") {
    return replyText(
      event.replyToken,
      "สวัสดีครับ ผมเป็นผู้ช่วย IT Support พิมพ์ปัญหาที่เจอมาได้เลย เช่น ลืมรหัสผ่าน, ต่อ Wi-Fi ไม่ได้, พิมพ์งานไม่ได้ หรือ VPN ใช้งานไม่ได้",
      { quickReply: ["ลืมรหัสผ่าน", "ต่อ Wi-Fi ไม่ได้", "พิมพ์งานไม่ได้", "VPN ใช้งานไม่ได้"] }
    );
  }

  if (event.type !== "message" || event.message?.type !== "text") {
    return replyText(
      event.replyToken,
      "ตอนนี้ผมรองรับคำถามแบบข้อความก่อนครับ กรุณาพิมพ์อาการที่พบ หรือส่ง screenshot พร้อมรายละเอียดให้ทีม IT โดยตรง"
    );
  }

  const userMessage = event.message.text.trim();
  if (!userMessage) return;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), config.maxAiWaitMs);

  try {
    const faqHints = await findFaqHints(userMessage);
    const answer = await askOpenRouter({
      userMessage,
      faqHints,
      userId: event.source?.userId,
      signal: controller.signal
    });

    await replyText(event.replyToken, answer, {
      quickReply: ["ยังแก้ไม่ได้", "ขอคุยกับ IT", "เริ่มคำถามใหม่"]
    });
  } catch (error) {
    console.error(error);
    await replyText(event.replyToken, fallbackAnswer());
  } finally {
    clearTimeout(timer);
  }
}

function readRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

function sendJson(res, statusCode, body) {
  res.writeHead(statusCode, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(body));
}
