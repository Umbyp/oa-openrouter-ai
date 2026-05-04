import { config } from "./config.js";

const OPENROUTER_CHAT_ENDPOINT = "https://openrouter.ai/api/v1/chat/completions";

export async function askOpenRouter({ userMessage, faqHints, userId, signal }) {
  const faqContext = faqHints.length
    ? faqHints
        .map((item) => `- ${item.title}: ${item.answer}`)
        .join("\n")
    : "ไม่มี FAQ ที่ match โดยตรง";

  const response = await fetch(OPENROUTER_CHAT_ENDPOINT, {
    method: "POST",
    signal,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.openRouter.apiKey}`,
      "HTTP-Referer": config.openRouter.siteUrl,
      "X-OpenRouter-Title": config.openRouter.appName
    },
    body: JSON.stringify({
      model: config.openRouter.model,
      temperature: 0.2,
      max_tokens: 900,
      user: userId,
      messages: [
        {
          role: "system",
          content:
            "คุณคือ IT Support assistant ขององค์กร ตอบเป็นภาษาไทย กระชับ สุภาพ และเป็นขั้นตอน ถ้าไม่มั่นใจให้ถามข้อมูลเพิ่มหรือส่งต่อทีม IT ห้ามเดาข้อมูลระบบภายในที่ไม่มีในบริบท"
        },
        {
          role: "system",
          content: `ข้อมูล FAQ ภายในที่เกี่ยวข้อง:\n${faqContext}\n\nช่องทางส่งต่อ: ${config.supportTeamContact}`
        },
        {
          role: "user",
          content: userMessage
        }
      ]
    })
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`OpenRouter failed: ${response.status} ${body}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content?.trim() || fallbackAnswer();
}

export function fallbackAnswer() {
  return `ตอนนี้ระบบ AI ตอบไม่ได้ชั่วคราวครับ\n\nกรุณาลองใหม่อีกครั้ง หรือส่งข้อมูลนี้ให้ทีม IT:\n- ปัญหาที่พบ\n- ชื่อผู้ใช้/อีเมลบริษัท\n- อุปกรณ์และระบบปฏิบัติการ\n- screenshot หรือข้อความ error\n- เวลาที่เกิดปัญหา\n\n${config.supportTeamContact}`;
}
