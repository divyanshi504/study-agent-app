import { NextResponse } from "next/server";
import { generateText } from "ai";
import { createAnthropic } from "@ai-sdk/anthropic";

export const runtime = "nodejs";

function getAnthropicClient() {
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  const authToken = process.env.ANTHROPIC_AUTH_TOKEN?.trim();

  if (!apiKey && !authToken) {
    throw new Error(
      "Missing Anthropic credentials. Set ANTHROPIC_API_KEY or ANTHROPIC_AUTH_TOKEN."
    );
  }

  return createAnthropic({
    apiKey: apiKey || undefined,
    authToken: authToken || undefined,
  });
}


type RequestBody = {
  userMessage: string;
};

type DetectionResult = {
  subject: string;
  concept: string;
};

function normalizeText(value: string | null | undefined) {
  return value?.trim() ?? "";
}

function parseDetectionResult(text: string): DetectionResult {
  const trimmed = normalizeText(text);
  if (!trimmed) {
    return { subject: "", concept: "" };
  }

  let jsonText = trimmed;
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start >= 0 && end > start) {
    jsonText = trimmed.slice(start, end + 1);
  }

  try {
    const parsed = JSON.parse(jsonText) as DetectionResult;
    if (
      typeof parsed?.subject === "string" &&
      typeof parsed?.concept === "string"
    ) {
      return {
        subject: normalizeText(parsed.subject),
        concept: normalizeText(parsed.concept),
      };
    }
  } catch {
    // continue to regex fallback
  }

  const subjectMatch = trimmed.match(/subject\s*[:=]\s*["']?\s*([^"'\n\r,]+?)\s*["']?(?:,|\n|$)/i);
  const conceptMatch = trimmed.match(/concept\s*[:=]\s*["']?\s*([^"'\n\r,]+?)\s*["']?(?:,|\n|$)/i);

  return {
    subject: normalizeText(subjectMatch?.[1] ?? ""),
    concept: normalizeText(conceptMatch?.[1] ?? ""),
  };
}

export async function POST(req: Request) {
  const body = (await req.json()) as RequestBody;
  const userMessage = normalizeText(body.userMessage);

  if (!userMessage) {
    return NextResponse.json({ error: "Missing userMessage" }, { status: 400 });
  }

  const systemPrompt =
    "You are a JSON extractor. Extract the subject and concept from the user's message. " +
    "Return ONLY a JSON object with exactly two string fields: subject and concept. " +
    "Example: {\"subject\": \"Math\", \"concept\": \"Calculus\"}. " +
    "If the message is not about studying a concept, return {\"subject\": \"\", \"concept\": \"\"}.";

  const prompt = `User message: ${userMessage}`;

  try {
    let anthropicClient;
    try {
      anthropicClient = getAnthropicClient();
    } catch (err: any) {
      return NextResponse.json(
        { error: "Anthropic client initialization failed", details: err?.message ?? String(err) },
        { status: 500 }
      );
    }

    const result = await generateText({
      model: anthropicClient("claude-sonnet-4-5"),
      system: systemPrompt,
      prompt,
      maxRetries: 0,
    });

    const detection = parseDetectionResult(result.text);
    return NextResponse.json(detection);
  } catch (err: any) {
    return NextResponse.json(
      { error: "Internal server error", details: err?.message ?? String(err) },
      { status: 500 }
    );
  }
}
