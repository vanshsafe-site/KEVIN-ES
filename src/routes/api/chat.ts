import { createFileRoute } from "@tanstack/react-router";

const SYSTEM_INSTRUCTION = `You are Kevin (K.E.V.I.N), a warm, concise emotional support companion created by Vansh Garg. Reply in short, human, plain-text sentences. No emojis. No asterisks. No markdown. Never claim to be a therapist; gently encourage professional help when appropriate. Be supportive, validating, and grounded.`;

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const body = (await request.json().catch(() => null)) as
            | { message?: unknown }
            | null;
          const message = body?.message;
          if (typeof message !== "string" || !message.trim()) {
            return new Response(JSON.stringify({ error: "Message is required." }), {
              status: 400,
              headers: { "Content-Type": "application/json" },
            });
          }

          const apiKey = process.env.GEMINI_API_KEY;
          if (!apiKey) {
            return new Response(JSON.stringify({ error: "AI is not configured." }), {
              status: 500,
              headers: { "Content-Type": "application/json" },
            });
          }

          const res = await fetch(
            `https://gemini.googleapis.com/v1/chat/completions?key=${encodeURIComponent(apiKey)}`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                model: "google/gemini-2.5-flash",
                messages: [
                  { role: "system", content: SYSTEM_INSTRUCTION },
                  { role: "user", content: message },
                ],
              }),
            },
          );

          if (!res.ok) {
            const text = await res.text().catch(() => "");
            console.error("AI gateway error", res.status, text);
            return new Response(
              JSON.stringify({ error: "Kevin couldn't respond right now." }),
              { status: 500, headers: { "Content-Type": "application/json" } },
            );
          }

          const data = (await res.json()) as {
            choices?: { message?: { content?: string } }[];
          };
          const reply = data.choices?.[0]?.message?.content?.trim() ?? "";
          return new Response(JSON.stringify({ reply }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        } catch (err) {
          console.error("chat handler error", err);
          return new Response(JSON.stringify({ error: "Something went wrong." }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }
      },
      GET: async () =>
        new Response(JSON.stringify({ error: "Method not allowed" }), {
          status: 405,
          headers: { "Content-Type": "application/json" },
        }),
    },
  },
});