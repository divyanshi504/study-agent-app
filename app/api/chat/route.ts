import { NextResponse } from "next/server";
import { streamText } from "ai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createClient } from "../../../lib/supabase";

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
  subject?: string;
  concept?: string;
};

type ConceptRow = {
  mastery_level: string | null;
  weak_areas: string | null;
  strong_areas: string | null;
};

function normalizeText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function buildPrompt(row: ConceptRow | null, subject: string, concept: string) {
  const subjectLabel = subject || "the subject";
  const conceptLabel = concept || "the concept";
  const weakAreas = normalizeText(row?.weak_areas);
  const strongAreas = normalizeText(row?.strong_areas);
  const profileContext = [
    weakAreas ? `Weak areas: ${weakAreas}.` : null,
    strongAreas ? `Strong areas: ${strongAreas}.` : null,
  ]
    .filter(Boolean)
    .join(" ");

  if (!row) {
    return `You are an educational tutor for ${conceptLabel} in ${subjectLabel}. Use Mode A: beginner friendly, analogy-first, and define all terms. ${profileContext} Keep the explanation clear, concrete, and accessible.`.trim();
  }

  const mastery = normalizeText(row.mastery_level);
  if (mastery === "Introduced" || mastery === "Developing") {
    return `You are an educational tutor for ${conceptLabel} in ${subjectLabel}. Use Mode B: reference prior knowledge, mention weak areas, and teach at a moderate pace. ${profileContext} Make sure the explanation feels supportive and builds confidence.`.trim();
  }

  if (mastery === "Proficient" || mastery === "Strong") {
    return `You are an educational tutor for ${conceptLabel} in ${subjectLabel}. Use Mode C: technical, skip basics, and focus on nuance. ${profileContext} Assume the learner already understands the fundamentals and emphasize deeper connections.`.trim();
  }

  return `You are an educational tutor for ${conceptLabel} in ${subjectLabel}. Use Mode A: beginner friendly, analogy-first, and define all terms. ${profileContext} Keep the explanation clear, concrete, and accessible.`.trim();
}

export async function POST(req: Request) {
  const body = (await req.json()) as RequestBody;
  const userMessage = normalizeText(body.userMessage);
  const subject = normalizeText(body.subject);
  const concept = normalizeText(body.concept);

  if (!userMessage) {
    return NextResponse.json({ error: "Missing userMessage" }, { status: 400 });
  }

  let conceptRow: ConceptRow | null = null;

  try {
    if (subject && concept) {
      let supabase;
      try {
        supabase = createClient();
      } catch (err: any) {
        return NextResponse.json(
          { error: "Supabase client initialization failed", details: err?.message ?? String(err) },
          { status: 500 }
        );
      }

      try {
        const { data, error } = await supabase
          .from("concepts")
          .select("mastery_level,weak_areas,strong_areas")
          .eq("subject", subject)
          .eq("concept", concept)
          .maybeSingle();

        if (error) {
          console.warn("Supabase query error:", error.message);
          conceptRow = null;
        } else {
          conceptRow = data;
        }
      } catch (err: any) {
        console.warn("Supabase request failed:", err?.message ?? String(err));
        conceptRow = null;
      }
    }

    const systemPrompt = buildPrompt(
      conceptRow,
      subject || "the subject",
      concept || "the concept"
    );

    let anthropicClient;
    try {
      anthropicClient = getAnthropicClient();
    } catch (err: any) {
      return NextResponse.json(
        { error: "Anthropic client initialization failed", details: err?.message ?? String(err) },
        { status: 500 }
      );
    }

    const result = await streamText({
      model: anthropicClient("claude-sonnet-4-5"),
      system: systemPrompt,
      prompt: userMessage,
      maxRetries: 0,
    });

    return new NextResponse(result.textStream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-cache",
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: "Internal server error", details: err?.message ?? String(err) },
      { status: 500 }
    );
  }
}
