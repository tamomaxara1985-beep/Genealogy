import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { connectDB } from "@/lib/db"
import Person from "@/lib/models/Person"
import Relationship from "@/lib/models/Relationship"
import Tree from "@/lib/models/Tree"
import type { IPersonDoc } from "@/lib/models/Person"
import type { IRelationshipDoc } from "@/lib/models/Relationship"

const STRICT_SYSTEM_PROMPT = `You are a professional Genealogy Research Consultant.

Your task is to help users discover information about their family history, ancestors, surnames, family relationships, historical records, migration paths, and genealogy-related topics.

When a user asks a question:
- Search only the provided genealogy sources.
- Extract information that directly answers the user's question.
- Rewrite the information in simple, human-friendly language.
- Keep answers concise, factual, and easy to understand.

Accuracy Rules:
- Every answer must be based only on information found in the provided sources.
- Never guess or infer relationships not explicitly in the records.
- Never generate hypothetical family connections.
- Never create dates, names, places, or events.

Missing Information Rule:
- If the answer cannot be found in the provided sources, return an empty response.
- Do not speculate or provide general genealogy knowledge.

Output Style:
- Simple, natural language.
- Short and clear.
- Do not mention sources, records, or where information was found.
- Do not explain your reasoning.`

const GENERAL_SYSTEM_PROMPT = `You are a professional Genealogy Research Consultant.

Help users with genealogy research, family history questions, surname origins, historical migration patterns, record types, and research tips. Provide factual, concise, easy-to-understand answers.`

function buildTreeContext(
  persons: IPersonDoc[],
  relationships: IRelationshipDoc[]
): string {
  const personMap = new Map(persons.map((p) => [p._id.toString(), p]))

  const personLines = persons.map((p) => {
    const parts: string[] = [`${p.firstName} ${p.lastName}`]
    if (p.birthDate) parts.push(`born ${p.birthDate}`)
    if (p.birthPlace) parts.push(`in ${p.birthPlace}`)
    if (p.deathDate) parts.push(`died ${p.deathDate}`)
    if (p.deathPlace) parts.push(`in ${p.deathPlace}`)
    return `- ${parts.join(", ")}`
  })

  const relLines = relationships
    .map((r) => {
      const p1 = personMap.get(r.person1Id.toString())
      const p2 = personMap.get(r.person2Id.toString())
      if (!p1 || !p2) return null
      const n1 = `${p1.firstName} ${p1.lastName}`
      const n2 = `${p2.firstName} ${p2.lastName}`
      if (r.type === "parent-child") return `- ${n1} is parent of ${n2}`
      if (r.type === "spouse") return `- ${n1} is married to ${n2}`
      return null
    })
    .filter(Boolean)

  return (
    `\n\nFamily tree contains ${persons.length} people:\n` +
    personLines.join("\n") +
    (relLines.length ? `\n\nRelationships:\n${relLines.join("\n")}` : "")
  )
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  if (!process.env.OPENROUTER_API_KEY)
    return NextResponse.json(
      { error: "AI service not configured" },
      { status: 500 }
    )

  let body: { messages?: unknown; treeId?: unknown }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
  }

  const { treeId } = body
  const messages = body.messages
  if (
    !Array.isArray(messages) ||
    messages.some(
      (m) =>
        typeof m !== "object" ||
        m === null ||
        !["user", "assistant"].includes((m as { role?: string }).role ?? "") ||
        typeof (m as { content?: string }).content !== "string"
    )
  ) {
    return NextResponse.json({ error: "Invalid messages" }, { status: 400 })
  }

  let systemPrompt = GENERAL_SYSTEM_PROMPT

  if (treeId) {
    await connectDB()
    const tree = await Tree.findOne({ _id: treeId, ownerId: session.user.id })
    if (!tree)
      return NextResponse.json({ error: "Tree not found" }, { status: 404 })

    const [persons, relationships] = await Promise.all([
      Person.find({ treeId }),
      Relationship.find({ treeId }),
    ])

    systemPrompt = STRICT_SYSTEM_PROMPT + buildTreeContext(persons, relationships)
  }

  const upstream = await fetch(
    "https://openrouter.ai/api/v1/chat/completions",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
      },
      body: JSON.stringify({
        model: "nvidia/nemotron-3-nano-30b-a3b:free",
        stream: true,
        messages: [{ role: "system", content: systemPrompt }, ...messages],
      }),
    }
  )

  if (!upstream.ok) {
    return NextResponse.json(
      { error: "AI service unavailable" },
      { status: 502 }
    )
  }

  return new Response(upstream.body, {
    headers: { "Content-Type": "text/event-stream" },
  })
}
