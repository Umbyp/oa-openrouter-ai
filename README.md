# LINE OA OpenRouter IT Support Bot

Starter project สำหรับทำ LINE Official Account ที่เชื่อม OpenRouter ให้เป็นผู้ช่วย IT support ภาษาไทย โดยตั้งใจออกแบบเป็นแนวฟรีก่อนทั้งหมด

## Free-First Stack

- LINE Official Account: ใช้แผนฟรี และให้ bot ตอบด้วย Reply API เท่านั้น
- OpenRouter: ใช้ `openrouter/free` หรือ model ที่ลงท้าย `:free`
- Hosting: ใช้ Cloudflare Workers Free บนโดเมน `workers.dev`
- Database: ยังไม่ใช้ DB ใน MVP ใช้ FAQ จากไฟล์ก่อน
- Ticket escalation: ให้ bot บอกช่องทางติดต่อ IT แทนการยิง push message หรือส่ง ticket ไป paid SaaS

## กฎกันค่าใช้จ่าย

1. ห้ามใช้ LINE push, multicast, narrowcast หรือ broadcast ใน MVP
2. ใช้เฉพาะ reply message หลัง user ทักเข้ามา เพราะ LINE ระบุว่า Reply API ไม่ถูกนับเป็น message quota ของ subscription plan
3. ตั้ง `OPENROUTER_MODEL=openrouter/free`
4. อย่าผูกบัตรหรือเปิด paid model/provider ใน OpenRouter ระหว่างทดสอบ
5. ใช้ Cloudflare Workers Free และดู usage ไม่ให้เกิน free tier

## ไฟล์สำคัญ

```text
src/worker.js       เวอร์ชัน Cloudflare Workers สำหรับใช้ฟรีบน HTTPS
wrangler.toml       config สำหรับ deploy Worker
src/server.js       เวอร์ชัน Node.js สำหรับรัน local หรือ deploy ที่รองรับ Node
src/line.js         LINE signature verification และ reply API สำหรับ Node
src/openrouter.js   OpenRouter chat completion สำหรับ Node
src/faq.js          FAQ loader สำหรับ Node
data/faq.json       FAQ seed
docs/ARCHITECTURE.md แผนสถาปัตยกรรมและ free-first roadmap
```

## วิธี Deploy ฟรีด้วย Cloudflare Workers

ทางที่ง่ายและยังไม่ต้องติดตั้งอะไร:

1. สมัคร Cloudflare ฟรี
2. เข้า Workers & Pages
3. Create Worker
4. วางโค้ดจาก `src/worker.js`
5. ตั้ง Environment Variables / Secrets:
   - `LINE_CHANNEL_ACCESS_TOKEN`
   - `LINE_CHANNEL_SECRET`
   - `OPENROUTER_API_KEY`
   - `OPENROUTER_MODEL=openrouter/free`
   - `SUPPORT_TEAM_CONTACT`
6. Deploy แล้วจะได้ URL แบบ `https://your-worker.your-subdomain.workers.dev`
7. ตั้ง LINE webhook URL เป็น `https://your-worker.your-subdomain.workers.dev/webhook/line`
8. ทดสอบ `https://your-worker.your-subdomain.workers.dev/health`

ถ้าจะใช้ CLI ภายหลัง สามารถใช้ `wrangler.toml` ที่เตรียมไว้ได้ แต่ไม่จำเป็นสำหรับ MVP

## LINE Setup

1. สร้าง LINE Official Account และ Messaging API channel
2. เปิด `Use webhook`
3. ตั้ง Webhook URL เป็น URL ของ Cloudflare Worker ตามด้วย `/webhook/line`
4. ใช้ Channel access token และ Channel secret มาใส่ใน Cloudflare Worker secrets
5. กด Verify webhook แล้วทดสอบด้วยการ add friend

ข้อควรจำ: reply token ใช้ได้ครั้งเดียวและมีเวลาจำกัด จึงควรให้ bot ตอบเร็ว และไม่ควรทำงานยาว ๆ ใน webhook

## OpenRouter Setup

1. สร้าง API key ใน OpenRouter
2. ตั้ง `OPENROUTER_API_KEY`
3. ตั้ง `OPENROUTER_MODEL=openrouter/free`

`openrouter/free` เป็น router สำหรับเลือก free model ให้อัตโนมัติ เหมาะกับ demo และ low-volume MVP แต่มีข้อจำกัดเรื่อง rate limit, latency และ availability

## ปรับ FAQ

สำหรับ Node version ให้แก้ `data/faq.json`

สำหรับ Cloudflare Worker MVP ให้แก้รายการ `FAQ` ใน `src/worker.js` ด้วย เพราะ Worker เวอร์ชันนี้ตั้งใจให้ไม่มี build step และไม่มี dependency

## รัน Local แบบ Node

ต้องใช้ Node.js 20 ขึ้นไป:

```powershell
Copy-Item .env.example .env
npm start
```

ตั้งค่าใน `.env`:

```text
LINE_CHANNEL_ACCESS_TOKEN=...
LINE_CHANNEL_SECRET=...
OPENROUTER_API_KEY=...
OPENROUTER_MODEL=openrouter/free
```

## แหล่งอ้างอิง

- [LINE Messaging API pricing](https://developers.line.biz/en/docs/messaging-api/pricing/)
- [LINE Official Account message limits](https://help2.line.me/official_account/web/pc?contentId=20013993&lang=en)
- [OpenRouter Free Models Router](https://openrouter.ai/docs/guides/routing/routers/free-models-router)
- [Cloudflare Workers limits](https://developers.cloudflare.com/workers/platform/limits/)
