"use client";

import { useState } from "react";
import NavBar from "./components/NavBar";

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  subject?: string;
  concept?: string;
  canSave?: boolean;
  saved?: boolean;
};

type DetectionResult = {
  subject: string;
  concept: string;
};

type SaveConceptPayload = {
  subject: string;
  concept: string;
  masteryLevel: string;
  overviewGist: string;
  deepDiveGist: string[];
  strongAreas: string[];
  weakAreas: string[];
  nextSteps: string[];
  notes: string;
};

const initialMessages: Message[] = [
  {
    id: "welcome",
    role: "assistant",
    content:
      "Hi there! Ask me about a subject or concept and I’ll help you explore it with a study-focused response.",
  },
];

function inferMasteryLevel(text: string) {
  const normalized = text.toLowerCase();
  if (/\b(proficient|strong)\b/.test(normalized)) return "Proficient";
  if (/\b(developing|introduced|beginner|introductory)\b/.test(normalized)) return "Developing";
  return "Developing";
}

function extractListSection(text: string, labels: string[]) {
  const labelRegex = new RegExp(`(?:${labels.join("|")})[:]?`, "i");
  const match = text.match(labelRegex);
  if (!match || match.index === undefined) return [];

  const sectionText = text.slice(match.index + match[0].length);
  const lines = sectionText
    .split(/\r?\n/)
    .map((line) => line.trim().replace(/^[*-–—]\s*/, ""))
    .filter(Boolean);

  const items: string[] = [];
  for (const line of lines) {
    if (/^[A-Z][a-z]+[:]/.test(line)) break;
    items.push(line);
    if (items.length >= 6) break;
  }

  return items;
}

function extractOverview(text: string) {
  const match = text.match(/(?:overview|summary|gist)[:]\s*([\s\S]+)/i);
  if (match && match[1]) {
    return match[1].split(/\r?\n/)[0].trim();
  }

  const paragraph = text.split(/\n\n/).find(Boolean) ?? text;
  return paragraph.trim().slice(0, 220);
}

function extractNextSteps(text: string) {
  return extractListSection(text, ["next steps", "next step", "to continue", "to practice"]);
}

function parseSaveConceptPayload(
  answer: string,
  subject: string,
  concept: string
): SaveConceptPayload {
  const masteryLevel = inferMasteryLevel(answer);
  const overviewGist = extractOverview(answer);
  const deepDiveGist =
    extractListSection(answer, ["deep dive", "deeper dive", "details", "deeper"])
      .slice(0, 3);

  return {
    subject,
    concept,
    masteryLevel,
    overviewGist,
    deepDiveGist: deepDiveGist.length > 0 ? deepDiveGist : [overviewGist],
    strongAreas: extractListSection(answer, ["strong areas", "strengths"]),
    weakAreas: extractListSection(answer, ["weak areas", "challenges", "areas to improve"]),
    nextSteps: extractNextSteps(answer),
    notes: answer.trim(),
  };
}

export default function Home() {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [draft, setDraft] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<string | null>(null);

  const updateAssistantContent = (id: string, content: string) => {
    setMessages((prev) =>
      prev.map((message) =>
        message.id === id ? { ...message, content } : message
      )
    );
  };

  const handleSaveProgress = async (message: Message) => {
    if (!message.subject || !message.concept) return;

    const payload = parseSaveConceptPayload(
      message.content,
      message.subject,
      message.concept
    );

    setSaveStatus("Saving progress...");

    const response = await fetch("/api/save-concept", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      setSaveStatus("Save failed.");
      return;
    }

    setMessages((prev) =>
      prev.map((item) =>
        item.id === message.id ? { ...item, saved: true, canSave: false } : item
      )
    );
    setSaveStatus("Progress saved.");
    window.setTimeout(() => setSaveStatus(null), 3000);
  };

  const handleSend = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    const content = draft.trim();
    if (!content) return;

    setDraft("");
    const userMessage: Message = {
      id: `${Date.now()}-user`,
      role: "user",
      content,
    };
    setMessages((prev) => [...prev, userMessage]);
    setIsLoading(true);

    const detectResponse = await fetch("/api/detect-concept", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userMessage: content }),
    });

    const detectJson = (await detectResponse.json().catch(() => ({
      subject: "",
      concept: "",
    }))) as DetectionResult;

    const assistantId = `${Date.now()}-assistant`;
    const assistantMessage: Message = {
      id: assistantId,
      role: "assistant",
      content: "",
      subject: detectJson.subject?.trim(),
      concept: detectJson.concept?.trim(),
      canSave: Boolean(detectJson.subject?.trim() && detectJson.concept?.trim()),
    };
    setMessages((prev) => [...prev, assistantMessage]);

    const chatResponse = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userMessage: content,
        subject: detectJson.subject,
        concept: detectJson.concept,
      }),
    });

    if (!chatResponse.ok) {
      setError("Unable to generate response. Please try again.");
      setIsLoading(false);
      updateAssistantContent(assistantId, "Failed to load response.");
      return;
    }

    const reader = chatResponse.body?.getReader();
    if (!reader) {
      const text = await chatResponse.text();
      updateAssistantContent(assistantId, text);
      setIsLoading(false);
      return;
    }

    const decoder = new TextDecoder();
    let assistantText = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      assistantText += decoder.decode(value, { stream: true });
      updateAssistantContent(assistantId, assistantText);
    }

    setIsLoading(false);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <NavBar />
      <main className="mx-auto flex min-h-screen max-w-5xl flex-col px-4 py-6 sm:px-6 lg:px-8">
        <div className="mb-6 flex flex-col gap-4 rounded-3xl border border-slate-800 bg-slate-900/90 p-6 shadow-xl shadow-slate-950/40 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-sky-300/80">
              Study Agent
            </p>
            <h1 className="mt-2 text-3xl font-semibold text-slate-50">
              AI chat tutor
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400 sm:text-base">
              Type any subject or concept and get a teaching-focused response. If a subject and concept are detected, you can save progress for later.
            </p>
          </div>
          <div className="rounded-3xl border border-slate-800 bg-slate-950/95 px-4 py-3 text-sm text-slate-400">
            Single user • No auth
          </div>
        </div>

        <div className="flex-1 overflow-hidden rounded-[2rem] border border-slate-800 bg-slate-900/95 shadow-xl shadow-slate-950/40">
          <div className="max-h-[62vh] space-y-4 overflow-y-auto px-5 py-6">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-2xl rounded-3xl border px-4 py-3 shadow-sm sm:px-5 sm:py-4 ${
                    message.role === "user"
                      ? "bg-sky-700 text-slate-100 shadow-sky-950/20"
                      : "bg-slate-900 text-slate-200 border-slate-800"
                  }`}
                >
                  {message.role === "assistant" && (
                    <div className="mb-2 flex items-center gap-2 text-xs uppercase tracking-[0.25em] text-slate-500">
                      <span className="inline-flex h-2.5 w-2.5 rounded-full bg-sky-400" />
                      Assistant
                    </div>
                  )}
                  <p className="whitespace-pre-line text-sm leading-7">
                    {message.content || (message.role === "assistant" ? "Thinking..." : "")}
                  </p>
                  {message.role === "assistant" && message.subject && message.concept && (
                    <div className="mt-4 flex flex-wrap gap-2 text-[11px] text-slate-400">
                      <span className="rounded-full bg-slate-800 px-2 py-1">
                        Subject: {message.subject}
                      </span>
                      <span className="rounded-full bg-slate-800 px-2 py-1">
                        Concept: {message.concept}
                      </span>
                    </div>
                  )}
                  {message.role === "assistant" && !message.canSave && !message.saved && !message.subject && !message.concept && (
                    <div className="mt-4 rounded-full bg-slate-800/70 px-3 py-2 text-xs text-slate-400">
                      No saveable subject or concept was detected from this question.
                    </div>
                  )}
                  {message.role === "assistant" && message.canSave && !message.saved && (
                    <div className="mt-4 flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => handleSaveProgress(message)}
                        className="rounded-full bg-sky-500 px-3 py-2 text-xs font-semibold text-slate-950 transition hover:bg-sky-400"
                      >
                        Save progress
                      </button>
                      {saveStatus && (
                        <span className="text-xs text-slate-400">{saveStatus}</span>
                      )}
                    </div>
                  )}
                  {message.role === "assistant" && message.saved && (
                    <div className="mt-4 rounded-full bg-emerald-500/10 px-3 py-2 text-xs text-emerald-300">
                      Progress saved
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          <form
            onSubmit={handleSend}
            className="border-t border-slate-800 bg-slate-950/95 px-4 py-4 sm:px-6"
          >
            <div className="flex flex-col gap-3 sm:flex-row">
              <input
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                placeholder="Ask about a subject, concept, or study plan..."
                className="min-h-[52px] flex-1 rounded-2xl border border-slate-800 bg-slate-950/95 px-4 py-3 text-sm text-slate-100 placeholder:text-slate-500 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/20"
              />
              <button
                type="submit"
                disabled={isLoading}
                className="inline-flex h-12 items-center justify-center rounded-2xl bg-sky-500 px-5 text-sm font-semibold text-slate-950 transition hover:bg-sky-400 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isLoading ? "Sending…" : "Send"}
              </button>
            </div>
            {error && (
              <p className="mt-3 text-sm text-rose-300">{error}</p>
            )}
          </form>
        </div>
      </main>
    </div>
  );
}
