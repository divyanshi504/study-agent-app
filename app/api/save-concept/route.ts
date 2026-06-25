import { NextResponse } from "next/server";
import { createClient } from "../../../lib/supabase";

type RequestBody = {
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

function isString(value: unknown): value is string {
  return typeof value === "string";
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function validateBody(body: unknown): RequestBody | null {
  if (typeof body !== "object" || body === null) return null;

  const data = body as Record<string, unknown>;

  if (!isString(data.subject) || !isString(data.concept)) return null;
  if (!isString(data.masteryLevel)) return null;
  if (!isString(data.overviewGist)) return null;
  if (!isStringArray(data.deepDiveGist)) return null;
  if (!isStringArray(data.strongAreas)) return null;
  if (!isStringArray(data.weakAreas)) return null;
  if (!isStringArray(data.nextSteps)) return null;
  if (!isString(data.notes)) return null;

  return {
    subject: data.subject.trim(),
    concept: data.concept.trim(),
    masteryLevel: data.masteryLevel.trim(),
    overviewGist: data.overviewGist.trim(),
    deepDiveGist: data.deepDiveGist,
    strongAreas: data.strongAreas,
    weakAreas: data.weakAreas,
    nextSteps: data.nextSteps,
    notes: data.notes.trim(),
  };
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const validated = validateBody(body);

  if (!validated) {
    return NextResponse.json(
      { error: "Invalid request body. subject, concept, masteryLevel, overviewGist, deepDiveGist, strongAreas, weakAreas, nextSteps, and notes are required." },
      { status: 400 }
    );
  }

  const supabase = createClient();
  const now = new Date().toISOString();

  const { error } = await supabase.from("concepts").upsert(
    {
      subject: validated.subject,
      concept: validated.concept,
      mastery_level: validated.masteryLevel,
      overview_gist: validated.overviewGist,
      deep_dive_gist: validated.deepDiveGist,
      strong_areas: validated.strongAreas,
      weak_areas: validated.weakAreas,
      next_steps: validated.nextSteps,
      notes: validated.notes,
      last_updated: now,
    },
    {
      onConflict: "subject,concept",
    }
  );

  if (error) {
    return NextResponse.json(
      { error: "Failed to save concept to Supabase", details: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true });
}
