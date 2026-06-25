import NavBar from "../components/NavBar";
import { createClient } from "../../lib/supabase";

type ConceptRow = {
  id: string;
  subject: string;
  concept: string;
  mastery_level: string | null;
  overview_gist: string | null;
  deep_dive_gist: string[] | null;
  strong_areas: string[] | null;
  weak_areas: string[] | null;
  next_steps: string[] | null;
  notes: string | null;
  last_updated: string | null;
};

const subjectColors: Record<string, string> = {
  Physics: "bg-blue-500/15 text-blue-300",
  Biology: "bg-emerald-500/15 text-emerald-300",
  Mathematics: "bg-violet-500/15 text-violet-300",
  "Computer Science": "bg-orange-500/15 text-orange-300",
  Chemistry: "bg-red-500/15 text-red-300",
};

const masteryScore: Record<string, number> = {
  Strong: 4,
  Proficient: 3,
  Developing: 2,
  Introduced: 1,
  "In Progress": 0,
};

function masteryLabel(value: string | null) {
  if (!value) return "In Progress";
  return value;
}

function progressPercent(value: string | null) {
  const score = value ? masteryScore[value] ?? 0 : 0;
  return Math.round((score / 4) * 100);
}

function formatDate(value: string | null) {
  if (!value) return "Unknown";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown";
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

async function getConceptRows() {
  const supabase = createClient();
  const { data, error } = await supabase.from("concepts").select("*");

  if (error) {
    throw new Error("Failed to load concepts");
  }

  return data ?? [];
}

export default async function DashboardPage() {
  const rows = await getConceptRows();
  const totalConcepts = rows.length;
  const uniqueSubjects = new Set(rows.map((row) => row.subject)).size;
  const averageScore =
    rows.length === 0
      ? 0
      : Math.round(
          (rows.reduce((sum, row) => sum + (masteryScore[row.mastery_level ?? "In Progress"] ?? 0), 0) /
            rows.length) *
            100 /
            4
        );

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <NavBar />
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <div className="mb-8 rounded-[2rem] border border-slate-800 bg-slate-900/95 p-6 shadow-xl shadow-slate-950/40">
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-3xl border border-slate-800 bg-slate-950/90 p-5">
              <p className="text-sm uppercase tracking-[0.3em] text-slate-500">Total concepts</p>
              <p className="mt-3 text-3xl font-semibold text-slate-50">{totalConcepts}</p>
            </div>
            <div className="rounded-3xl border border-slate-800 bg-slate-950/90 p-5">
              <p className="text-sm uppercase tracking-[0.3em] text-slate-500">Unique subjects</p>
              <p className="mt-3 text-3xl font-semibold text-slate-50">{uniqueSubjects}</p>
            </div>
            <div className="rounded-3xl border border-slate-800 bg-slate-950/90 p-5">
              <p className="text-sm uppercase tracking-[0.3em] text-slate-500">Average mastery</p>
              <p className="mt-3 text-3xl font-semibold text-slate-50">{averageScore}%</p>
            </div>
          </div>
        </div>

        <div className="grid gap-6">
          {rows.map((concept) => (
            <details
              key={concept.id}
              className="overflow-hidden rounded-[2rem] border border-slate-800 bg-slate-900/95 shadow-xl shadow-slate-950/20"
            >
              <summary className="cursor-pointer px-6 py-5 transition hover:bg-slate-800/50">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="space-y-3">
                    <div className="flex flex-wrap items-center gap-3">
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.3em] ${
                          subjectColors[concept.subject] ?? "bg-slate-800 text-slate-300"
                        }`}
                      >
                        {concept.subject}
                      </span>
                      <span className="text-lg font-semibold text-slate-100">{concept.concept}</span>
                    </div>
                    <div className="flex flex-wrap gap-3 text-sm text-slate-400">
                      <span className="rounded-full border border-slate-700 bg-slate-950/90 px-3 py-1">
                        {masteryLabel(concept.mastery_level)}
                      </span>
                      <span className="rounded-full border border-slate-700 bg-slate-950/90 px-3 py-1">
                        Last updated {formatDate(concept.last_updated)}
                      </span>
                    </div>
                  </div>
                  <div className="flex-1 min-w-[220px]">
                    <div className="mb-2 flex items-center justify-between text-sm text-slate-500">
                      <span>Progress</span>
                      <span>{progressPercent(concept.mastery_level)}%</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-slate-800">
                      <div
                        className="h-full rounded-full bg-sky-500"
                        style={{ width: `${progressPercent(concept.mastery_level)}%` }}
                      />
                    </div>
                  </div>
                </div>
              </summary>
              <div className="border-t border-slate-800 bg-slate-950/90 px-6 py-5">
                <div className="grid gap-5 sm:grid-cols-3">
                  <div>
                    <p className="mb-2 text-sm font-semibold text-slate-200">Strong areas</p>
                    <div className="flex flex-wrap gap-2">
                      {(concept.strong_areas ?? []).map((item: string, index: number) => (
                        <span
                          key={index}
                          className="rounded-full bg-emerald-500/10 px-3 py-1 text-xs text-emerald-300"
                        >
                          {item}
                        </span>
                      ))}
                      {(concept.strong_areas ?? []).length === 0 && (
                        <span className="text-sm text-slate-500">No strong areas listed</span>
                      )}
                    </div>
                  </div>
                  <div>
                    <p className="mb-2 text-sm font-semibold text-slate-200">Weak areas</p>
                    <div className="flex flex-wrap gap-2">
                      {(concept.weak_areas ?? []).map((item: string, index: number) => (
                        <span
                          key={index}
                          className="rounded-full bg-red-500/10 px-3 py-1 text-xs text-red-300"
                        >
                          {item}
                        </span>
                      ))}
                      {(concept.weak_areas ?? []).length === 0 && (
                        <span className="text-sm text-slate-500">No weak areas listed</span>
                      )}
                    </div>
                  </div>
                  <div>
                    <p className="mb-2 text-sm font-semibold text-slate-200">Next steps</p>
                    <div className="flex flex-wrap gap-2">
                      {(concept.next_steps ?? []).map((item: string, index: number) => (
                        <span
                          key={index}
                          className="rounded-full bg-sky-500/10 px-3 py-1 text-xs text-sky-300"
                        >
                          {item}
                        </span>
                      ))}
                      {(concept.next_steps ?? []).length === 0 && (
                        <span className="text-sm text-slate-500">No next steps listed</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </details>
          ))}
        </div>
      </div>
    </div>
  );
}
