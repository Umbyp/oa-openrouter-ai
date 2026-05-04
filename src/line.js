import crypto from "node:crypto";
import { config } from "./config.js";

const LINE_REPLY_ENDPOINT = "https://api.line.me/v2/bot/message/reply";

export function verifyLineSignature(rawBody, signature) {
  if (!signature || Array.isArray(signature) || !config.line.channelSecret) return false;

  const expected = crypto
    .createHmac("sha256", config.line.channelSecret)
    .update(rawBody)
    .digest("base64");

  if (signature.length !== expected.length) return false;

  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
}

export async function replyText(replyToken, text, options = {}) {
  const message = {
    type: "text",
    text: truncateLineText(text)
  };

  if (options.quickReply) {
    message.quickReply = {
      items: options.quickReply.map((label) => ({
        type: "action",
        action: {
          type: "message",
          label,
          text: label
        }
      }))
    };
  }

  const response = await fetch(LINE_REPLY_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.line.channelAccessToken}`
    },
    body: JSON.stringify({
      replyToken,
      messages: [message]
    })
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`LINE reply failed: ${response.status} ${body}`);
  }
}

function truncateLineText(text) {
  const maxLength = 4900;
  return text.length > maxLength
    ? `${text.slice(0, maxLength - 80)}\n\nข้อความยาวเกินไป กรุณาถามเจาะจงเพิ่มอีกนิดครับ`
    : text;
}
