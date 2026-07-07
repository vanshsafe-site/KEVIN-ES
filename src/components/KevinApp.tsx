import { useCallback, useEffect, useRef, useState } from "react";

type Role = "user" | "kevin";
interface Message {
  id: string;
  role: Role;
  text: string;
  error?: boolean;
}

type SpeechRecognitionLike = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  onresult: ((event: { resultIndex: number; results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
};

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

declare global {
  interface Window {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
    faceapi?: any;
  }
}

const SUGGESTIONS = [
  "I'm feeling anxious",
  "I had a rough day",
  "I can't sleep",
];

function uid() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

async function sendToKevin(message: string): Promise<string> {
  const res = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Something went wrong." }));
    throw new Error(err.error || "Something went wrong.");
  }
  const data = (await res.json()) as { reply?: string };
  return data.reply ?? "";
}

export function KevinApp() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [voiceSupported, setVoiceSupported] = useState(false);
  const [autoSpeak, setAutoSpeak] = useState(true);
  const [voiceStatus, setVoiceStatus] = useState("Voice ready");
  const [faceScanOpen, setFaceScanOpen] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  const [faceLoading, setFaceLoading] = useState(false);
  const [faceMood, setFaceMood] = useState("Neutral");
  const [faceConfidence, setFaceConfidence] = useState(0.38);
  const [faceStatus, setFaceStatus] = useState(
    "Tap to scan your face and let Kevin estimate your mood.",
  );
  const chatRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const autoSendTimerRef = useRef<number | null>(null);
  const faceScanTimerRef = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const nearBottomRef = useRef(true);
  const sendRef = useRef<(raw: string) => Promise<void>>(() => Promise.resolve());

  // auto-grow textarea
  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = Math.min(ta.scrollHeight, 6.5 * 16) + "px";
  }, [input]);

  // track scroll position
  useEffect(() => {
    const el = chatRef.current;
    if (!el) return;
    const onScroll = () => {
      nearBottomRef.current =
        el.scrollHeight - el.scrollTop - el.clientHeight < 120;
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, []);

  // auto-scroll on new messages if user was near bottom
  useEffect(() => {
    if (!nearBottomRef.current) return;
    const el = chatRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, loading]);

  const stopFaceScan = useCallback(() => {
    if (faceScanTimerRef.current) {
      window.clearInterval(faceScanTimerRef.current);
      faceScanTimerRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setCameraActive(false);
    setFaceLoading(false);
    setFaceStatus("Face scan paused.");
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const SpeechRecognitionCtor =
      window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognitionCtor) {
      setVoiceSupported(false);
      setVoiceStatus("Voice input is not supported in this browser.");
      return;
    }

    const recognition = new SpeechRecognitionCtor();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    recognition.onresult = (event) => {
      let interimText = "";
      let finalText = "";

      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const result = event.results[index];
        const transcript = result[0].transcript.trim();
        if (result[0].transcript) {
          if (result.isFinal) {
            finalText += `${transcript} `;
          } else {
            interimText += `${transcript} `;
          }
        }
      }

      const nextText = (finalText || interimText).trim();
      if (nextText) {
        setInput(nextText);
      }

      if (finalText.trim()) {
        if (autoSendTimerRef.current) {
          window.clearTimeout(autoSendTimerRef.current);
        }
        autoSendTimerRef.current = window.setTimeout(() => {
          void sendRef.current(finalText.trim());
        }, 300);
      }
    };

    recognition.onerror = () => {
      setIsListening(false);
      setVoiceStatus("Voice input was interrupted.");
    };

    recognition.onend = () => {
      setIsListening(false);
      setVoiceStatus("Voice input ready.");
    };

    recognitionRef.current = recognition;
    setVoiceSupported(true);
    setVoiceStatus("Voice ready");

    return () => {
      recognition.stop();
      recognitionRef.current = null;
      if (autoSendTimerRef.current) {
        window.clearTimeout(autoSendTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    return () => {
      stopFaceScan();
    };
  }, [stopFaceScan]);

  const speakText = useCallback(
    (text: string) => {
      if (typeof window === "undefined" || !autoSpeak) return;
      if (!("speechSynthesis" in window)) return;

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = "en-US";
      utterance.rate = 1;
      utterance.pitch = 1;
      utterance.volume = 1;
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(utterance);
    },
    [autoSpeak],
  );

  const send = useCallback(
    async (raw: string) => {
      const text = raw.trim();
      if (!text || loading) return;
      const userMsg: Message = { id: uid(), role: "user", text };
      setMessages((m) => [...m, userMsg]);
      setInput("");
      setLoading(true);
      nearBottomRef.current = true;
      try {
        const reply = await sendToKevin(text);
        setMessages((m) => [
          ...m,
          { id: uid(), role: "kevin", text: reply || "…" },
        ]);
        if (reply) {
          window.setTimeout(() => speakText(reply), 100);
        }
      } catch (e) {
        const msg =
          e instanceof Error
            ? e.message
            : "Kevin couldn't respond right now — try again.";
        setMessages((m) => [
          ...m,
          { id: uid(), role: "kevin", text: msg, error: true },
        ]);
        setInput(text);
      } finally {
        setLoading(false);
        setTimeout(() => textareaRef.current?.focus(), 0);
      }
    },
    [loading, speakText],
  );

  useEffect(() => {
    sendRef.current = send;
  }, [send]);

  const toggleListening = useCallback(() => {
    const recognition = recognitionRef.current;
    if (!voiceSupported || !recognition) {
      setVoiceStatus("Voice input is not available on this device.");
      return;
    }

    if (isListening) {
      recognition.stop();
      setIsListening(false);
      setVoiceStatus("Voice input stopped.");
      return;
    }

    setIsListening(true);
    setVoiceStatus("Listening…");
    recognition.start();
  }, [isListening, voiceSupported]);

  const startFaceScan = useCallback(async () => {
    if (typeof window === "undefined") return;
    if (!navigator.mediaDevices?.getUserMedia) {
      setFaceStatus("Camera access is not available on this browser.");
      return;
    }

    setFaceLoading(true);
    setFaceStatus("Loading your camera and mood model…");

    try {
      if (!window.faceapi) {
        await new Promise<void>((resolve, reject) => {
          const existingScript = document.querySelector(
            'script[src*="face-api.js"]',
          ) as HTMLScriptElement | null;

          if (existingScript) {
            if (window.faceapi) {
              resolve();
              return;
            }
            existingScript.addEventListener("load", () => resolve(), { once: true });
            existingScript.addEventListener("error", () => reject(new Error("Unable to load face analysis library.")), { once: true });
            return;
          }

          const script = document.createElement("script");
          script.src = "https://cdn.jsdelivr.net/npm/face-api.js@0.22.2/dist/face-api.min.js";
          script.async = true;
          script.onload = () => resolve();
          script.onerror = () => reject(new Error("Unable to load face analysis library."));
          document.body.appendChild(script);
        });
      }

      const modelUrl = "https://cdn.jsdelivr.net/npm/face-api.js@0.22.2/weights/";
      await window.faceapi?.nets?.tinyFaceDetector?.load(modelUrl);
      await window.faceapi?.nets?.faceLandmark68Net?.load(modelUrl);
      await window.faceapi?.nets?.faceExpressionNet?.load(modelUrl);

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user" },
        audio: false,
      });

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        streamRef.current = stream;
        await videoRef.current.play();
      }

      setCameraActive(true);
      setFaceScanOpen(true);
      setFaceLoading(false);
      setFaceStatus("Camera ready — hold still for a moment.");

      if (faceScanTimerRef.current) {
        window.clearInterval(faceScanTimerRef.current);
      }

      const scanFace = async () => {
        if (!videoRef.current || !window.faceapi) return;
        if (videoRef.current.readyState < 2) return;

        try {
          const result = await window.faceapi
            .detectSingleFace(
              videoRef.current,
              new window.faceapi.TinyFaceDetectorOptions({
                inputSize: 224,
                scoreThreshold: 0.5,
              }),
            )
            .withFaceLandmarks()
            .withFaceExpressions();

          if (!result?.expressions) {
            setFaceStatus("No face detected yet. Move a little closer to the camera.");
            return;
          }

          const entries = Object.entries(result.expressions as Record<string, number>);
          const [expression, score] = entries.sort((a, b) => b[1] - a[1])[0] ?? ["neutral", 0.4];

          const moodMap: Record<string, { label: string; message: string }> = {
            happy: { label: "Cheerful", message: "You look upbeat and bright." },
            sad: { label: "Reflective", message: "You seem thoughtful or a little low." },
            angry: { label: "Tense", message: "You seem tense or stressed." },
            fearful: { label: "Uneasy", message: "You seem uneasy right now." },
            surprised: { label: "Surprised", message: "You look caught off guard." },
            disgusted: { label: "Cautious", message: "You look guarded or uncomfortable." },
            neutral: { label: "Neutral", message: "Your expression looks calm and steady." },
          };

          const mood = moodMap[expression] ?? moodMap.neutral;
          setFaceMood(mood.label);
          setFaceConfidence(Number(score.toFixed(2)));
          setFaceStatus(`${mood.message} ${Math.round(score * 100)}% confidence.`);
        } catch {
          setFaceStatus("The face scan is still warming up — try again in a second.");
        }
      };

      void scanFace();
      faceScanTimerRef.current = window.setInterval(() => {
        void scanFace();
      }, 1200);
    } catch (error) {
      setFaceLoading(false);
      setCameraActive(false);
      setFaceStatus(
        error instanceof Error
          ? error.message
          : "Camera access was blocked. Please allow camera permission and try again.",
      );
    }
  }, []);

  const toggleFaceScan = useCallback(async () => {
    if (faceScanOpen) {
      stopFaceScan();
      setFaceScanOpen(false);
      return;
    }

    setFaceScanOpen(true);
    await startFaceScan();
  }, [faceScanOpen, startFaceScan, stopFaceScan]);

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void send(input);
    }
  };

  const canSend = input.trim().length > 0 && !loading;

  return (
    <div className="kevin-app">
      <header className="kevin-header">
        <div className="kevin-logo" aria-hidden="true" />
        <div className="kevin-title">
          <strong>K.E.V.I.N</strong>
          <span>Your Emotional Support Companion</span>
        </div>
      </header>

      <main className="kevin-chat" ref={chatRef}>
        <div className="kevin-chat-inner" aria-live="polite">
          <section className="kevin-face-scan" aria-live="polite">
            <div className="kevin-face-scan-header">
              <div>
                <h3>Face mood scan</h3>
                <p>Let Kevin estimate your current mood from your camera.</p>
              </div>
              <button
                type="button"
                className="kevin-face-scan-toggle"
                onClick={() => void toggleFaceScan()}
              >
                {faceScanOpen ? "Hide scan" : "Scan face"}
              </button>
            </div>
            {faceScanOpen ? (
              <div className="kevin-face-scan-body">
                <div className="kevin-face-video-wrap">
                  {cameraActive ? (
                    <video
                      ref={videoRef}
                      className="kevin-face-video"
                      autoPlay
                      playsInline
                      muted
                    />
                  ) : (
                    <div className="kevin-face-placeholder">
                      <span>Camera preview will appear here</span>
                    </div>
                  )}
                </div>
                <div className="kevin-face-insight">
                  <div className="kevin-face-pill">
                    {faceLoading ? "Reading…" : faceMood}
                  </div>
                  <p>{faceStatus}</p>
                  <div className="kevin-face-confidence">
                    <span>Confidence</span>
                    <strong>{Math.round(faceConfidence * 100)}%</strong>
                  </div>
                  <div className="kevin-face-actions">
                    <button
                      type="button"
                      className="kevin-face-button kevin-face-button-primary"
                      onClick={() => void startFaceScan()}
                      disabled={faceLoading || cameraActive}
                    >
                      {cameraActive ? "Scanning…" : "Start camera"}
                    </button>
                    <button
                      type="button"
                      className="kevin-face-button"
                      onClick={() => stopFaceScan()}
                      disabled={!cameraActive}
                    >
                      Stop
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <p className="kevin-face-hint">
                Tap “Scan face” to let Kevin read your expression and offer a kinder response.
              </p>
            )}
          </section>

          {messages.length === 0 ? (
            <div className="kevin-empty">
              <div
                className="kevin-logo"
                aria-hidden="true"
                style={{ width: 72, height: 72 }}
              />
              <h2>Hi, I'm Kevin. What's weighing on you?</h2>
              <p>A space to vent, reflect, or just be heard — no judgment.</p>
              <div className="kevin-chips">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    className="kevin-chip"
                    onClick={() => void send(s)}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((m) => (
              <div
                key={m.id}
                className={`kevin-msg ${m.role}${m.error ? " error" : ""}`}
              >
                {m.text}
              </div>
            ))
          )}
          {loading && (
            <div className="kevin-typing" aria-label="Kevin is typing">
              <i />
              <i />
              <i />
            </div>
          )}
        </div>
      </main>

      <form
        className="kevin-inputbar"
        onSubmit={(e) => {
          e.preventDefault();
          void send(input);
        }}
      >
        <div className="kevin-inputbar-inner">
          <button
            type="button"
            className={`kevin-voice ${isListening ? "active" : ""}`}
            onClick={toggleListening}
            disabled={!voiceSupported}
            aria-label={isListening ? "Stop voice input" : "Start voice input"}
          >
            {isListening ? "■" : "♫"}
          </button>
          <button
            type="button"
            className={`kevin-voice kevin-voice-secondary ${autoSpeak ? "active" : ""}`}
            onClick={() => setAutoSpeak((value) => !value)}
            aria-label={autoSpeak ? "Mute voice replies" : "Enable voice replies"}
          >
            {autoSpeak ? "🔊" : "🔈"}
          </button>
          <textarea
            ref={textareaRef}
            className="kevin-textarea"
            placeholder="Tell Kevin what's on your mind…"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            rows={1}
            aria-label="Message Kevin"
          />
          <button
            type="submit"
            className="kevin-send"
            disabled={!canSend}
            aria-label="Send message"
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M4 12l16-8-6 16-2-7-8-1z" />
            </svg>
          </button>
        </div>
        <div className="kevin-voice-status" aria-live="polite">
          {isListening ? "Listening for your voice…" : voiceStatus}
        </div>
      </form>
    </div>
  );
}