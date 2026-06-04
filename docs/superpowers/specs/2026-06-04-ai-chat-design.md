# AI Chat Feature — Design Spec

**Date:** 2026-06-04
**Status:** Approved

## Summary

Floating AI chat widget available on all dashboard pages. Uses OpenRouter API (`nvidia/nemotron-3-nano-30b-a3b:free`) with streaming responses. Acts as a Genealogy Research Consultant. When user is viewing a family tree, injects that tree's persons and relationships as context so the AI can answer questions about specific ancestors.

---

## Architecture

```
Client (ChatWidget)
  → POST /api/ai/chat  { messages[], treeId? }
      → auth() guard — 401 if no session
      → if treeId: fetch persons + relationships from MongoDB
      → serialize tree data → human-readable context block
      → POST https://openrouter.ai/api/v1/chat/completions (stream: true)
      → pipe ReadableStream back to client
  → client reads SSE chunks → appends to last assistant message
```

**New files:**
- `app/api/ai/chat/route.ts` — streaming proxy route
- `components/ai/ChatWidget.tsx` — floating button + chat panel
- `components/ai/ChatMessage.tsx` — single message bubble

**Modified files:**
- `app/(dashboard)/layout.tsx` — add `<ChatWidget />` at bottom
- `.env.local` — add `OPENROUTER_API_KEY`

---

## API Route — `POST /api/ai/chat`

### Request

```ts
{
  messages: { role: "user" | "assistant", content: string }[]
  treeId?: string
}
```

### Auth

`await auth()` — returns 401 if no session. Same pattern as all other API routes.

### Tree Context Injection

If `treeId` provided:
1. Fetch `Person[]` where `treeId` matches, owned by session user
2. Fetch `Relationship[]` for same tree
3. Serialize to plain text block:

```
Family tree contains N people:
- John Smith (born 1920, died 1985)
- Jane Smith (born 1952)

Relationships:
- John Smith is father of Jane Smith
```

Text injected at end of system prompt, before user messages.

### System Prompt (two modes)

**With tree context (strict mode):** Used when `treeId` provided. Accuracy rules enforced — only answers from provided tree data. Returns empty if answer not in sources.

**Without tree context (general mode):** Used when no `treeId`. Allows general genealogy knowledge — surname origins, historical migration patterns, record types, research tips.

### Strict Mode System Prompt

```
You are a professional Genealogy Research Consultant.

Your task is to help users discover information about their family history,
ancestors, surnames, family relationships, historical records, migration paths,
and genealogy-related topics.

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
- Do not explain your reasoning.
```

### Streaming Response

```ts
const upstream = await fetch("https://openrouter.ai/api/v1/chat/completions", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
  },
  body: JSON.stringify({
    model: "nvidia/nemotron-3-nano-30b-a3b:free",
    stream: true,
    messages: [{ role: "system", content: systemPrompt }, ...messages],
  }),
})
return new Response(upstream.body, {
  headers: { "Content-Type": "text/event-stream" },
})
```

### Error Handling

- OpenRouter non-200 → return 502 with `{ error: "AI service unavailable" }`
- Missing `OPENROUTER_API_KEY` → return 500
- No `treeId` → use relaxed system prompt (allows general genealogy knowledge, no sources-only restriction)

---

## Frontend Components

### `ChatWidget.tsx`

Client component. Placed in `app/(dashboard)/layout.tsx` so it appears on all dashboard pages.

**State:**
```ts
const [open, setOpen] = useState(false)
const [messages, setMessages] = useState<ChatMessage[]>([])
const [input, setInput] = useState("")
const [streaming, setStreaming] = useState(false)
```

**`treeId` detection:** `usePathname()` — extract from `/trees/[treeId]` pattern. If not on a tree page, `treeId` is `undefined`.

**UI — Closed state:**
- Fixed bottom-right, z-50
- Amber circular button (matches app color scheme `#f59e0b`)
- Chat bubble icon

**UI — Open state:**
- Fixed bottom-right, 380×500px panel
- White card with shadow, rounded corners
- Header: "AI Research Assistant" title + X close button
- Messages area: scrollable `flex-col` div, auto-scroll to bottom on new message
- User messages: right-aligned, amber background
- Assistant messages: left-aligned, gray background
- Input row: text input + Send button (disabled while `streaming`)

**Streaming read loop:**
```ts
const reader = res.body!.getReader()
const decoder = new TextDecoder()
// append SSE chunks to last assistant message content
// parse `data: {...}` lines, extract delta content
```

### `ChatMessage.tsx`

Renders single message bubble. Converts `\n` to `<br />`. No markdown library needed — answers are plain prose.

**Props:**
```ts
{ role: "user" | "assistant", content: string }
```

---

## Environment Variables

Add to `.env.local`:
```
OPENROUTER_API_KEY=sk-or-v1-...
```

**Never expose to client.** Used only in `app/api/ai/chat/route.ts` (server-side).

---

## Data Types

Add to `types/index.ts`:
```ts
export interface ChatMessage {
  role: "user" | "assistant"
  content: string
}
```

---

## Out of Scope

- Chat history persistence (session-only, resets on refresh)
- Per-person context injection (page-aware, phase 2)
- Markdown rendering in messages
- Rate limiting
- Token count limits on tree context
