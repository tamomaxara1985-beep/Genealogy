export const RESEARCHER_STATUSES = ["Assigned", "In Progress", "Completed"] as const;
export type ResearcherStatus = (typeof RESEARCHER_STATUSES)[number];

export interface ResearcherValue {
  fullName: string;
  contact: string;
  notes?: string;
  assignmentDate: string;
  status: ResearcherStatus;
}

type Result =
  | { ok: true; value: ResearcherValue }
  | { ok: false; error: string };

function asTrimmedString(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

export function validateResearcher(input: unknown, today: string): Result {
  const obj = (input ?? {}) as Record<string, unknown>;

  const fullName = asTrimmedString(obj.fullName);
  const contact = asTrimmedString(obj.contact);
  if (!fullName) return { ok: false, error: "fullName is required" };
  if (!contact) return { ok: false, error: "contact is required" };

  let status: ResearcherStatus = "Assigned";
  if (obj.status !== undefined && obj.status !== null && obj.status !== "") {
    if (!RESEARCHER_STATUSES.includes(obj.status as ResearcherStatus))
      return { ok: false, error: "invalid status" };
    status = obj.status as ResearcherStatus;
  }

  const assignmentDate = asTrimmedString(obj.assignmentDate) || today;
  const notes = asTrimmedString(obj.notes);

  const value: ResearcherValue = { fullName, contact, assignmentDate, status };
  if (notes) value.notes = notes;

  return { ok: true, value };
}
