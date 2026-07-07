import { GoogleGenAI } from "@google/genai";
import { createFileRoute } from "@tanstack/react-router";

const vision = process.env.GOOGLE_APPLICATION_CREDENTIALS
  ? undefined
  : undefined;

const SYSTEM_INSTRUCTION = `You are Kevin (K.E.V.I.N), a warm, concise emotional support companion created by Vansh Garg. Reply in short, human, plain-text sentences. No emojis. No asterisks. No markdown. Never claim to be a therapist; gently encourage professional help when appropriate. Be supportive, validating, and grounded.`;

async function analyzeFaceWithVision(imageBase64: string) {
  try {
    const { ImageAnnotatorClient } = await import("@google-cloud/vision");
    const client = new ImageAnnotatorClient();

    const [result] = await client.faceDetection({
      image: {
        content: imageBase64,
      },
    });

    const faces = result.faceAnnotations ?? [];
    if (!faces.length) {
      return { mood: "Neutral", confidence: 0.4, message: "No face detected yet. Move closer to the camera." };
    }

    const face = faces[0];
    const joy = Number(face.joyLikelihood ?? 0);
    const sorrow = Number(face.sorrowLikelihood ?? 0);
    const anger = Number(face.angerLikelihood ?? 0);
    const surprise = Number(face.surpriseLikelihood ?? 0);
    const headwear = Number(face.headwearLikelihood ?? 0);

    const likelihoodScore = (value: number) => {
      switch (value) {
        case 1:
          return 0.2;
        case 2:
          return 0.35;
        case 3:
          return 0.55;
        case 4:
          return 0.75;
        case 5:
          return 0.95;
        default:
          return 0.1;
      }
    };

    const scores = {
      happy: likelihoodScore(joy),
      sad: likelihoodScore(sorrow),
      angry: likelihoodScore(anger),
      surprised: likelihoodScore(surprise),
      neutral: 1 - Math.max(likelihoodScore(joy), likelihoodScore(sorrow), likelihoodScore(anger), likelihoodScore(surprise)),
      covered: likelihoodScore(headwear),
    };

    const dominant = Object.entries(scores).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "neutral";

    const moodMap: Record<string, { mood: string; message: string }> = {
      happy: { mood: "Cheerful", message: "You look upbeat and bright." },
      sad: { mood: "Reflective", message: "You seem thoughtful or a little low." },
      angry: { mood: "Tense", message: "You seem tense or stressed." },
      surprised: { mood: "Surprised", message: "You look caught off guard." },
      covered: { mood: "Covered", message: "Your face is partly obscured, so I’m reading less clearly." },
      neutral: { mood: "Neutral", message: "Your expression looks calm and steady." },
    };

    const mood = moodMap[dominant] ?? moodMap.neutral;
    return {
      mood: mood.mood,
      confidence: Math.max(0.4, Math.min(0.98, Number(scores[dominant].toFixed(2)))),
      message: mood.message,
    };
  } catch (error) {
    console.error("vision analysis error", error);
    return {
      mood: "Neutral",
      confidence: 0.4,
      message: "The face analysis service is unavailable right now.",
    };
  }
}

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const body = (await request.json().catch(() => null)) as
            | { message?: unknown; image?: unknown; mode?: unknown }
            | null;
          const message = body?.message;
          const image = body?.image;
          const mode = body?.mode;

          if (typeof mode === "string" && mode === "face") {
            if (typeof image !== "string" || !image.trim()) {
              return new Response(JSON.stringify({ error: "Image is required." }), {
                status: 400,
                headers: { "Content-Type": "application/json" },
              });
            }

            const result = await analyzeFaceWithVision(image);
            return new Response(JSON.stringify(result), {
              status: 200,
              headers: { "Content-Type": "application/json" },
            });
          }

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

          const ai = new GoogleGenAI({ apiKey });
          const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: `${SYSTEM_INSTRUCTION}\n\nUser: ${message}`,
          });

          const reply = response.text?.trim() ?? "";
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