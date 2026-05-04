const LINE_REPLY_ENDPOINT = "https://api.line.me/v2/bot/message/reply";
const OPENROUTER_CHAT_ENDPOINT = "https://openrouter.ai/api/v1/chat/completions";

const FAQ = [
  {
    id: "password-reset",
    title: "ลืมรหัสผ่าน / รีเซ็ตรหัสผ่าน",
    keywords: ["ลืมรหัส", "password", "reset", "เข้าไม่ได้", "ล็อกอินไม่ได้"],
    answer:
      "ให้เข้า portal รีเซ็ตรหัสผ่านของบริษัทก่อน ถ้ายังเข้าไม่ได้ ให้ส่งชื่อผู้ใช้, อีเมลบริษัท, หน้าจอ error และเวลาที่พบปัญหาให้ทีม IT ตรวจสอบ"
  },
  {
    id: "wifi",
    title: "ต่อ Wi-Fi บริษัทไม่ได้",
    keywords: ["wifi", "wi-fi", "ไวไฟ", "internet", "เน็ต", "ต่อเน็ต"],
    answer:
      "ลองลืมเครือข่ายแล้วเชื่อมต่อใหม่ ตรวจสอบว่าใช้บัญชีบริษัทล่าสุด และปิด/เปิด Wi-Fi อีกครั้ง ถ้ายังไม่ได้ ให้แจ้งชื่ออุปกรณ์, ระบบปฏิบัติการ และสาขาที่ใช้งาน"
  },
  {
    id: "printer",
    title: "พิมพ์งานไม่ได้",
    keywords: ["printer", "print", "ปริ้น", "พิมพ์", "เครื่องพิมพ์"],
    answer:
      "ตรวจสอบว่าเลือกเครื่องพิมพ์ถูกตัว มีกระดาษ/หมึกเพียงพอ และลอง restart เครื่องคอมพิวเตอร์ ถ้ายังไม่ได้ ให้ส่งชื่อเครื่องพิมพ์และไฟล์/โปรแกรมที่ใช้พิมพ์"
  },
  {
    id: "vpn",
    title: "VPN ใช้งานไม่ได้",
    keywords: ["vpn", "remote", "ทำงานที่บ้าน", "เข้า server", "เข้าระบบไม่ได้"],
    answer:
      "ตรวจสอบอินเทอร์เน็ตก่อน จากนั้นออกจาก VPN แล้วเข้าสู่ระบบใหม่ ถ้า MFA ไม่ขึ้นหรือ token หมดอายุ ให้แจ้งทีม IT พร้อม screenshot และเวลาที่เกิดปัญหา"
  }
];

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === "GET" && url.pathname === "/health") {
      return json({ ok: true, runtime: "cloudflare-worker", costMode: "free-first" });
    }

    if (request.method === "POST" && url.pathname === "/webhook/line") {
      return handleLineWebhook(request, env);
    }

    return json({ error: "not_found" }, 404);
  }
};

async function handleLineWebhook(request, env) {
  const rawBody = await request.text();
  const signature = request.headers.get("x-line-signature");

  if (!(await verifyLineSignature(rawBody, signature, env.LINE_CHANNEL_SECRET))) {
    return json({ error: "invalid_signature" }, 401);
  }

  const payload = JSON.parse(rawBody);
  const results = await Promise.allSettled(
    (payload.events || []).map((event) => handleLineEvent(event, env))
  );

  for (const result of results) {
    if (result.status === "rejected") console.error(result.reason);
  }

  return json({ ok: true });
}

async function handleLineEvent(event, env) {
  if (!event.replyToken) return;

  if (event.type === "follow") {
    return replyText(
      event.replyToken,
      "สวัสดีครับ ผมเป็นผู้ช่วย IT Support พิมพ์ปัญหาที่เจอมาได้เลย เช่น ลืมรหัสผ่าน, ต่อ Wi-Fi ไม่ได้, พิมพ์งานไม่ได้ หรือ VPN ใช้งานไม่ได้",
      env,
      ["ลืมรหัสผ่าน", "ต่อ Wi-Fi ไม่ได้", "พิมพ์งานไม่ได้", "VPN ใช้งานไม่ได้"]
    );
  }

  if (event.type !== "message" || event.message?.type !== "text") {
    return replyText(
      event.replyToken,
      "ตอนนี้ผมรองรับคำถามแบบข้อความก่อนครับ กรุณาพิมพ์อาการที่พบ หรือส่ง screenshot พร้อมรายละเอียดให้ทีม IT โดยตรง",
      env
    );
  }

  const userMessage = event.message.text.trim();
  if (!userMessage) return;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), Number(env.MAX_AI_WAIT_MS || 45000));

  try {
    const faqHints = findFaqHints(userMessage);
    const answer = await askOpenRouter({
      userMessage,
      faqHints,
      userId: event.source?.userId,
      signal: controller.signal,
      env
    });

    return replyText(event.replyToken, answer, env, [
      "ยังแก้ไม่ได้",
      "ขอคุยกับ IT",
      "เริ่มคำถามใหม่"
    ]);
  } catch (error) {
    console.error(error);
    return replyText(event.replyToken, fallbackAnswer(env), env);
  } finally {
    clearTimeout(timer);
  }
}

function findFaqHints(question, limit = 3) {
  const normalized = question.toLowerCase();

  return FAQ.map((item) => {
    const score = item.keywords.reduce((total, keyword) => {
      return normalized.includes(keyword.toLowerCase()) ? total + 1 : total;
    }, 0);
    return { ...item, score };
  })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

async function askOpenRouter({ userMessage, faqHints, userId, signal, env }) {
  const faqContext = faqHints.length
    ? faqHints.map((item) => `- ${item.title}: ${item.answer}`).join("\n")
    : "ไม่มี FAQ ที่ match โดยตรง";

  const response = await fetch(OPENROUTER_CHAT_ENDPOINT, {
    method: "POST",
    signal,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${env.OPENROUTER_API_KEY}`,
      "HTTP-Referer": env.OPENROUTER_SITE_URL || "https://workers.dev",
      "X-OpenRouter-Title": env.OPENROUTER_APP_NAME || "LINE OA IT Support"
    },
    body: JSON.stringify({
      model: env.OPENROUTER_MODEL || "openrouter/free",
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
          content: `ข้อมูล FAQ ภายในที่เกี่ยวข้อง:\n${faqContext}\n\nช่องทางส่งต่อ: ${supportContact(env)}`
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
  return data.choices?.[0]?.message?.content?.trim() || fallbackAnswer(env);
}

async function replyText(replyToken, text, env, quickReply = []) {
  const message = {
    type: "text",
    text: truncateLineText(text)
  };

  if (quickReply.length) {
    message.quickReply = {
      items: quickReply.map((label) => ({
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
      Authorization: `Bearer ${env.LINE_CHANNEL_ACCESS_TOKEN}`
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

async function verifyLineSignature(rawBody, signature, channelSecret) {
  if (!signature || !channelSecret) return false;

  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(channelSecret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const digest = await crypto.subtle.sign("HMAC", key, encoder.encode(rawBody));
  const expected = arrayBufferToBase64(digest);

  return constantTimeEqual(signature, expected);
}

function constantTimeEqual(a, b) {
  if (a.length !== b.length) return false;

  let mismatch = 0;
  for (let index = 0; index < a.length; index += 1) {
    mismatch |= a.charCodeAt(index) ^ b.charCodeAt(index);
  }

  return mismatch === 0;
}

function arrayBufferToBase64(buffer) {
  let binary = "";
  const bytes = new Uint8Array(buffer);
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function truncateLineText(text) {
  const maxLength = 4900;
  return text.length > maxLength
    ? `${text.slice(0, maxLength - 80)}\n\nข้อความยาวเกินไป กรุณาถามเจาะจงเพิ่มอีกนิดครับ`
    : text;
}

function fallbackAnswer(env) {
  return `ตอนนี้ระบบ AI ตอบไม่ได้ชั่วคราวครับ\n\nกรุณาลองใหม่อีกครั้ง หรือส่งข้อมูลนี้ให้ทีม IT:\n- ปัญหาที่พบ\n- ชื่อผู้ใช้/อีเมลบริษัท\n- อุปกรณ์และระบบปฏิบัติการ\n- screenshot หรือข้อความ error\n- เวลาที่เกิดปัญหา\n\n${supportContact(env)}`;
}

function supportContact(env) {
  return (
    env.SUPPORT_TEAM_CONTACT ||
    "ติดต่อ IT Support พร้อม screenshot, ชื่อผู้ใช้, อุปกรณ์ และเวลาที่พบปัญหา"
  );
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" }
  });
}
