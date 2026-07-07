# K.E.V.I.N. — Your Mental Health Companion

K.E.V.I.N. (short/concise emotional support AI) is a lightweight chatbot web app powered by Google Gemini, wrapped in a neon glassmorphic UI. Built and maintained by **Vansh Garg**.

---

## ✨ Features

- Calm, focused emotional-support chatbot persona ("Kevin") — no emojis, no fluff, stays on-topic
- Neon cyan/navy glassmorphic aesthetic
- Serverless backend (Vercel) — no server to manage
- Powered by Google Gemini (`gemini-2.0-flash`)
- Mobile-first, optimized for low-end devices

---

## 🧱 Tech Stack

| Layer      | Tech |
|------------|------|
| Frontend   | React (Vite) / static HTML+CSS+JS |
| Backend    | Vercel Serverless Function (`api/chat.js`) |
| AI Model   | Google Gemini API (`@google/generative-ai`) |
| Hosting    | Vercel |

---

## 📁 Project Structure

```
.
├── index.html          # Frontend entry point
├── logo.png            # App logo
├── api/
│   └── chat.js         # Serverless function — calls Gemini API
├── package.json
├── package-lock.json
└── vercel.json          # Vercel build config
```

---

## 🚀 Getting Started

### 1. Clone the repo
```bash
git clone https://github.com/vanshsafe-site/<repo-name>.git
cd <repo-name>
```

### 2. Install dependencies
```bash
npm install
```

### 3. Set up environment variables
Create a `.env` file (or set it in your Vercel project settings):

```
GEMINI_API_KEY=your_google_gemini_api_key_here
```

> Get a key from [Google AI Studio](https://aistudio.google.com/app/apikey).

### 4. Run locally
```bash
vercel dev
```
This spins up both the static frontend and the `/api/chat` serverless function locally.

### 5. Deploy
```bash
vercel --prod
```
Make sure `GEMINI_API_KEY` is added under **Project Settings → Environment Variables** on Vercel before deploying.

---

## 🔌 API Contract

**Endpoint:** `POST /api/chat`

**Request body:**
```json
{ "message": "I'm feeling anxious today" }
```

**Success response:**
```json
{ "reply": "That sounds hard. Want to tell me what's making you feel anxious?" }
```

**Error response:**
```json
{ "error": "Message is required" }
```

---

## 🧠 Persona

Kevin is instructed to:
- Stay short and concise
- Avoid emojis and asterisks
- Stay focused on emotional/mental health support only
- Never break character or get distracted from that purpose

This system instruction lives in `api/chat.js` and should be the single source of truth for Kevin's behavior — do not duplicate persona logic in the frontend.

---

## ⚠️ Disclaimer

Kevin is an AI companion for casual emotional support and is **not a replacement for professional mental health care**. If you or someone you know is in crisis, please contact a licensed professional or a crisis helpline in your region.

---

## 👤 Author

**Vansh Garg**
- Portfolio: [vanshgarg.vercel.app](https://vanshgarg.vercel.app)
- GitHub: [@vanshsafe-site](https://github.com/vanshsafe-site)

---

## 📄 License

This project is currently unlicensed / all rights reserved by the author unless stated otherwise.