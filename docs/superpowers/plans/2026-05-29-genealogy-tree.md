# Genealogy Tree Site Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a public genealogy platform (like Ancestry.com) where users create/share family trees with AI-powered OCR, story generation, and DNA matching.

**Architecture:** Next.js App Router with API routes as the backend, Mongoose models for MongoDB, NextAuth v5 for multi-provider auth. Family tree rendered with React Flow. AI features powered by Anthropic Claude API (stories) + Tesseract.js (OCR).

**Tech Stack:** Next.js 15, Tailwind CSS, shadcn/ui, Mongoose, NextAuth v5, React Flow, Anthropic SDK, Tesseract.js, MongoDB Atlas

---

## File Map

```
app/
  (auth)/login/page.tsx          — login page
  (auth)/register/page.tsx       — register page
  (auth)/layout.tsx              — auth layout (no sidebar)
  (dashboard)/dashboard/page.tsx — user dashboard, list trees
  (dashboard)/trees/page.tsx     — all user trees
  (dashboard)/trees/[treeId]/page.tsx      — view/explore tree
  (dashboard)/trees/[treeId]/edit/page.tsx — edit tree structure
  (dashboard)/person/[personId]/page.tsx   — person profile
  (dashboard)/layout.tsx         — dashboard layout with navbar/sidebar
  api/auth/[...nextauth]/route.ts — NextAuth handler
  api/trees/route.ts             — GET list, POST create tree
  api/trees/[treeId]/route.ts    — GET, PATCH, DELETE tree
  api/trees/[treeId]/persons/route.ts — GET tree persons, POST add person
  api/persons/[personId]/route.ts — GET, PATCH, DELETE person
  api/persons/[personId]/relationships/route.ts — manage relationships
  api/ai/ocr/route.ts            — OCR endpoint
  api/ai/story/route.ts          — story generation endpoint
  api/ai/dna/route.ts            — DNA/GEDCOM matching endpoint
  layout.tsx                     — root layout
  page.tsx                       — landing page

components/
  tree/FamilyTree.tsx            — React Flow tree canvas
  tree/PersonNode.tsx            — custom React Flow node
  tree/TreeControls.tsx          — zoom/pan/layout controls
  tree/AddPersonModal.tsx        — modal to add person to tree
  person/PersonCard.tsx          — compact person card
  person/PersonForm.tsx          — create/edit person form
  person/PersonProfile.tsx       — full profile view with events
  person/EventList.tsx           — list person's life events
  ai/OCRUploader.tsx             — drag-drop doc upload → OCR
  ai/StoryDisplay.tsx            — rendered AI bio
  ai/DNAMatcher.tsx              — DNA/GEDCOM upload + results
  layout/Navbar.tsx              — top nav with user menu
  layout/Sidebar.tsx             — left sidebar nav

lib/
  db.ts                          — Mongoose connection singleton
  auth.ts                        — NextAuth config
  utils.ts                       — shared helpers

models/
  User.ts                        — User schema
  Tree.ts                        — FamilyTree schema
  Person.ts                      — Person schema
  Event.ts                       — LifeEvent schema (birth/death/marriage)
  Relationship.ts                — parent/child/spouse links

types/
  index.ts                       — shared TS types

hooks/
  useTree.ts                     — tree CRUD hooks
  usePerson.ts                   — person CRUD hooks
  useAI.ts                       — AI feature hooks
```

---

## Phase 1: Project Setup + Frontend

### Task 1: Scaffold Next.js project

**Files:**
- Create: `package.json`, `next.config.ts`, `tailwind.config.ts`, `tsconfig.json`
- Create: `app/layout.tsx`, `app/page.tsx`

- [ ] **Step 1: Init Next.js project**

```bash
npx create-next-app@latest . --typescript --tailwind --eslint --app --src-dir=false --import-alias="@/*" --yes
```

Expected: project scaffold created, `npm run dev` starts on port 3000.

- [ ] **Step 2: Install shadcn/ui**

```bash
npx shadcn@latest init -d
```

Answer prompts: style=default, base color=slate, CSS variables=yes.

- [ ] **Step 3: Install core dependencies**

```bash
npm install mongoose next-auth@beta @auth/mongodb-adapter react-flow-renderer @xyflow/react lucide-react @anthropic-ai/sdk tesseract.js
npm install -D @types/node
```

- [ ] **Step 4: Install shadcn components**

```bash
npx shadcn@latest add button card dialog form input label select textarea badge avatar dropdown-menu sheet tabs toast
```

- [ ] **Step 5: Add env file**

Create `.env.local`:
```
MONGODB_URI=mongodb+srv://...
NEXTAUTH_SECRET=your-secret-here
NEXTAUTH_URL=http://localhost:3000
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
FACEBOOK_CLIENT_ID=
FACEBOOK_CLIENT_SECRET=
ANTHROPIC_API_KEY=
RESEND_API_KEY=
```

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: scaffold Next.js project with shadcn/ui and dependencies"
```

---

### Task 2: Shared types

**Files:**
- Create: `types/index.ts`

- [ ] **Step 1: Write types**

```typescript
// types/index.ts
export interface IUser {
  _id: string
  name: string
  email: string
  image?: string
  createdAt: Date
}

export interface ITree {
  _id: string
  name: string
  description?: string
  ownerId: string
  isPublic: boolean
  createdAt: Date
  updatedAt: Date
}

export interface IPerson {
  _id: string
  treeId: string
  firstName: string
  lastName: string
  maidenName?: string
  gender: 'male' | 'female' | 'other' | 'unknown'
  birthDate?: string
  birthPlace?: string
  deathDate?: string
  deathPlace?: string
  isLiving: boolean
  photoUrl?: string
  notes?: string
  bio?: string
  createdAt: Date
  updatedAt: Date
}

export interface IEvent {
  _id: string
  personId: string
  type: 'birth' | 'death' | 'marriage' | 'divorce' | 'immigration' | 'other'
  date?: string
  place?: string
  description?: string
  documentUrls: string[]
}

export interface IRelationship {
  _id: string
  treeId: string
  type: 'parent-child' | 'spouse'
  person1Id: string
  person2Id: string
  // for spouse: marriage date etc
  startDate?: string
  endDate?: string
}

export type TreeNode = {
  id: string
  data: { person: IPerson }
  position: { x: number; y: number }
  type: 'personNode'
}

export type TreeEdge = {
  id: string
  source: string
  target: string
  type: 'step'
  label?: string
}
```

- [ ] **Step 2: Commit**

```bash
git add types/index.ts
git commit -m "feat: add shared TypeScript types"
```

---

### Task 3: Landing page

**Files:**
- Modify: `app/page.tsx`
- Modify: `app/layout.tsx`

- [ ] **Step 1: Write root layout**

```tsx
// app/layout.tsx
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'FamilyRoots — Discover Your Family History',
  description: 'Build, explore, and share your family tree with AI-powered tools',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={inter.className}>{children}</body>
    </html>
  )
}
```

- [ ] **Step 2: Write landing page**

```tsx
// app/page.tsx
import Link from 'next/link'
import { Button } from '@/components/ui/button'

export default function LandingPage() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-amber-50 to-white">
      <nav className="flex items-center justify-between px-8 py-4 border-b bg-white/80 backdrop-blur">
        <span className="text-2xl font-bold text-amber-800">FamilyRoots</span>
        <div className="flex gap-3">
          <Button variant="ghost" asChild><Link href="/login">Sign in</Link></Button>
          <Button asChild><Link href="/register">Get started</Link></Button>
        </div>
      </nav>

      <section className="max-w-4xl mx-auto text-center py-24 px-4">
        <h1 className="text-6xl font-bold text-gray-900 mb-6">
          Discover Your<br /><span className="text-amber-700">Family Story</span>
        </h1>
        <p className="text-xl text-gray-600 mb-8 max-w-2xl mx-auto">
          Build your family tree, upload old documents, and let AI help uncover your ancestors' stories.
        </p>
        <Button size="lg" asChild>
          <Link href="/register">Start your free tree</Link>
        </Button>
      </section>

      <section className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-8 px-8 pb-24">
        {[
          { title: 'Visual Tree Builder', desc: 'Drag-and-drop interface to build your family tree' },
          { title: 'AI Story Generation', desc: 'Generate life stories from names, dates, and places' },
          { title: 'Document OCR', desc: 'Upload birth certificates and extract data automatically' },
        ].map((f) => (
          <div key={f.title} className="bg-white rounded-xl shadow-sm p-6 border">
            <h3 className="font-semibold text-lg mb-2">{f.title}</h3>
            <p className="text-gray-500 text-sm">{f.desc}</p>
          </div>
        ))}
      </section>
    </main>
  )
}
```

- [ ] **Step 3: Run and verify**

```bash
npm run dev
```

Open http://localhost:3000. Expect: landing page with nav, hero, 3 feature cards.

- [ ] **Step 4: Commit**

```bash
git add app/layout.tsx app/page.tsx
git commit -m "feat: add landing page"
```

---

### Task 4: Auth layout + pages

**Files:**
- Create: `app/(auth)/layout.tsx`
- Create: `app/(auth)/login/page.tsx`
- Create: `app/(auth)/register/page.tsx`

- [ ] **Step 1: Auth layout**

```tsx
// app/(auth)/layout.tsx
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-amber-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">{children}</div>
    </div>
  )
}
```

- [ ] **Step 2: Login page (UI only — auth wired in Phase 3)**

```tsx
// app/(auth)/login/page.tsx
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export default function LoginPage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Welcome back</CardTitle>
        <CardDescription>Sign in to your FamilyRoots account</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Button variant="outline" className="w-full">Google</Button>
          <Button variant="outline" className="w-full">Facebook</Button>
        </div>
        <div className="relative">
          <div className="absolute inset-0 flex items-center"><span className="w-full border-t" /></div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-white px-2 text-muted-foreground">Or continue with</span>
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" placeholder="you@example.com" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <Input id="password" type="password" />
        </div>
        <Button className="w-full">Sign in</Button>
        <p className="text-center text-sm text-muted-foreground">
          No account? <Link href="/register" className="underline">Register</Link>
        </p>
      </CardContent>
    </Card>
  )
}
```

- [ ] **Step 3: Register page**

```tsx
// app/(auth)/register/page.tsx
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export default function RegisterPage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Create account</CardTitle>
        <CardDescription>Start building your family tree for free</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Button variant="outline" className="w-full">Google</Button>
          <Button variant="outline" className="w-full">Facebook</Button>
        </div>
        <div className="relative">
          <div className="absolute inset-0 flex items-center"><span className="w-full border-t" /></div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-white px-2 text-muted-foreground">Or with email</span>
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="name">Full name</Label>
          <Input id="name" placeholder="Jane Doe" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" placeholder="you@example.com" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <Input id="password" type="password" />
        </div>
        <Button className="w-full">Create account</Button>
        <p className="text-center text-sm text-muted-foreground">
          Have account? <Link href="/login" className="underline">Sign in</Link>
        </p>
      </CardContent>
    </Card>
  )
}
```

- [ ] **Step 4: Verify pages render**

Visit http://localhost:3000/login and http://localhost:3000/register. Expect: centered card forms.

- [ ] **Step 5: Commit**

```bash
git add app/(auth)/
git commit -m "feat: add auth layout, login and register UI pages"
```

---

### Task 5: Dashboard layout + Navbar + Sidebar

**Files:**
- Create: `components/layout/Navbar.tsx`
- Create: `components/layout/Sidebar.tsx`
- Create: `app/(dashboard)/layout.tsx`
- Create: `app/(dashboard)/dashboard/page.tsx`

- [ ] **Step 1: Navbar component**

```tsx
// components/layout/Navbar.tsx
import Link from 'next/link'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'

export function Navbar() {
  return (
    <header className="h-14 border-b bg-white flex items-center justify-between px-6">
      <Link href="/dashboard" className="text-xl font-bold text-amber-800">
        FamilyRoots
      </Link>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="relative h-9 w-9 rounded-full">
            <Avatar className="h-9 w-9">
              <AvatarImage src="" />
              <AvatarFallback>U</AvatarFallback>
            </Avatar>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem asChild><Link href="/settings">Settings</Link></DropdownMenuItem>
          <DropdownMenuItem>Sign out</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  )
}
```

- [ ] **Step 2: Sidebar component**

```tsx
// components/layout/Sidebar.tsx
import Link from 'next/link'
import { Home, Trees, User, Dna } from 'lucide-react'

const nav = [
  { href: '/dashboard', label: 'Dashboard', icon: Home },
  { href: '/trees', label: 'My Trees', icon: Trees },
  { href: '/profile', label: 'Profile', icon: User },
  { href: '/dna', label: 'DNA Matches', icon: Dna },
]

export function Sidebar() {
  return (
    <aside className="w-56 border-r bg-gray-50 min-h-screen pt-4">
      <nav className="space-y-1 px-3">
        {nav.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className="flex items-center gap-3 px-3 py-2 rounded-md text-sm text-gray-700 hover:bg-amber-50 hover:text-amber-800 transition-colors"
          >
            <Icon className="h-4 w-4" />
            {label}
          </Link>
        ))}
      </nav>
    </aside>
  )
}
```

- [ ] **Step 3: Dashboard layout**

```tsx
// app/(dashboard)/layout.tsx
import { Navbar } from '@/components/layout/Navbar'
import { Sidebar } from '@/components/layout/Sidebar'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <div className="flex flex-1">
        <Sidebar />
        <main className="flex-1 p-6 bg-gray-50">{children}</main>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Dashboard page (stub)**

```tsx
// app/(dashboard)/dashboard/page.tsx
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import Link from 'next/link'

export default function DashboardPage() {
  return (
    <div className="max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">My Trees</h1>
        <Button asChild><Link href="/trees/new">New Tree</Link></Button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="border-dashed border-2 flex items-center justify-center min-h-40 cursor-pointer hover:border-amber-400">
          <CardContent className="text-center pt-6">
            <p className="text-muted-foreground">+ Create your first tree</p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
```

- [ ] **Step 5: Verify**

Visit http://localhost:3000/dashboard. Expect: navbar + sidebar + dashboard content.

- [ ] **Step 6: Commit**

```bash
git add components/layout/ app/(dashboard)/
git commit -m "feat: add dashboard layout with navbar and sidebar"
```

---

### Task 6: PersonCard and PersonForm components

**Files:**
- Create: `components/person/PersonCard.tsx`
- Create: `components/person/PersonForm.tsx`

- [ ] **Step 1: PersonCard**

```tsx
// components/person/PersonCard.tsx
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import type { IPerson } from '@/types'

interface Props {
  person: IPerson
  onClick?: () => void
}

export function PersonCard({ person, onClick }: Props) {
  const initials = `${person.firstName[0]}${person.lastName[0]}`
  return (
    <Card
      className="cursor-pointer hover:shadow-md transition-shadow w-48"
      onClick={onClick}
    >
      <CardContent className="pt-4 flex flex-col items-center gap-2">
        <Avatar className="h-16 w-16">
          <AvatarImage src={person.photoUrl} />
          <AvatarFallback className="text-lg">{initials}</AvatarFallback>
        </Avatar>
        <div className="text-center">
          <p className="font-semibold text-sm">{person.firstName} {person.lastName}</p>
          {person.birthDate && (
            <p className="text-xs text-muted-foreground">b. {person.birthDate}</p>
          )}
          {!person.isLiving && person.deathDate && (
            <p className="text-xs text-muted-foreground">d. {person.deathDate}</p>
          )}
        </div>
        <Badge variant={person.gender === 'male' ? 'secondary' : 'outline'} className="text-xs">
          {person.gender}
        </Badge>
      </CardContent>
    </Card>
  )
}
```

- [ ] **Step 2: PersonForm**

```tsx
// components/person/PersonForm.tsx
'use client'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import type { IPerson } from '@/types'

interface Props {
  initial?: Partial<IPerson>
  onSubmit: (data: Partial<IPerson>) => void
  loading?: boolean
}

export function PersonForm({ initial = {}, onSubmit, loading }: Props) {
  const [form, setForm] = useState<Partial<IPerson>>({
    firstName: '',
    lastName: '',
    gender: 'unknown',
    isLiving: true,
    ...initial,
  })

  const set = (k: keyof IPerson, v: unknown) => setForm(p => ({ ...p, [k]: v }))

  return (
    <form
      onSubmit={e => { e.preventDefault(); onSubmit(form) }}
      className="space-y-4"
    >
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>First name *</Label>
          <Input value={form.firstName} onChange={e => set('firstName', e.target.value)} required />
        </div>
        <div className="space-y-2">
          <Label>Last name *</Label>
          <Input value={form.lastName} onChange={e => set('lastName', e.target.value)} required />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Maiden name</Label>
          <Input value={form.maidenName ?? ''} onChange={e => set('maidenName', e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>Gender</Label>
          <Select value={form.gender} onValueChange={v => set('gender', v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="male">Male</SelectItem>
              <SelectItem value="female">Female</SelectItem>
              <SelectItem value="other">Other</SelectItem>
              <SelectItem value="unknown">Unknown</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Birth date</Label>
          <Input type="date" value={form.birthDate ?? ''} onChange={e => set('birthDate', e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>Birth place</Label>
          <Input value={form.birthPlace ?? ''} onChange={e => set('birthPlace', e.target.value)} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Death date</Label>
          <Input type="date" value={form.deathDate ?? ''} onChange={e => set('deathDate', e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>Death place</Label>
          <Input value={form.deathPlace ?? ''} onChange={e => set('deathPlace', e.target.value)} />
        </div>
      </div>
      <div className="space-y-2">
        <Label>Notes</Label>
        <Textarea value={form.notes ?? ''} onChange={e => set('notes', e.target.value)} rows={3} />
      </div>
      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? 'Saving...' : 'Save person'}
      </Button>
    </form>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add components/person/
git commit -m "feat: add PersonCard and PersonForm components"
```

---

### Task 7: Family tree canvas with React Flow

**Files:**
- Create: `components/tree/PersonNode.tsx`
- Create: `components/tree/FamilyTree.tsx`
- Create: `components/tree/TreeControls.tsx`
- Create: `app/(dashboard)/trees/[treeId]/page.tsx`

- [ ] **Step 1: PersonNode (custom React Flow node)**

```tsx
// components/tree/PersonNode.tsx
'use client'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import type { IPerson } from '@/types'

export function PersonNode({ data }: NodeProps<{ person: IPerson }>) {
  const { person } = data
  const initials = `${person.firstName[0]}${person.lastName[0]}`
  return (
    <div className="bg-white border-2 border-amber-200 rounded-xl p-3 shadow-sm min-w-36 text-center hover:border-amber-500 transition-colors">
      <Handle type="target" position={Position.Top} className="!bg-amber-400" />
      <Avatar className="h-12 w-12 mx-auto mb-2">
        <AvatarImage src={person.photoUrl} />
        <AvatarFallback>{initials}</AvatarFallback>
      </Avatar>
      <p className="font-semibold text-sm">{person.firstName}</p>
      <p className="text-sm text-gray-700">{person.lastName}</p>
      {person.birthDate && <p className="text-xs text-gray-400">b. {person.birthDate}</p>}
      <Handle type="source" position={Position.Bottom} className="!bg-amber-400" />
    </div>
  )
}
```

- [ ] **Step 2: FamilyTree canvas**

```tsx
// components/tree/FamilyTree.tsx
'use client'
import {
  ReactFlow, Background, Controls, MiniMap,
  type Node, type Edge, useNodesState, useEdgesState,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { PersonNode } from './PersonNode'
import type { TreeNode, TreeEdge } from '@/types'

const nodeTypes = { personNode: PersonNode }

interface Props {
  nodes: TreeNode[]
  edges: TreeEdge[]
  onNodeClick?: (personId: string) => void
}

export function FamilyTree({ nodes: initialNodes, edges: initialEdges, onNodeClick }: Props) {
  const [nodes, , onNodesChange] = useNodesState(initialNodes as Node[])
  const [edges, , onEdgesChange] = useEdgesState(initialEdges as Edge[])

  return (
    <div className="w-full h-full min-h-[600px] rounded-xl border bg-amber-50/30">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
        onNodeClick={(_, node) => onNodeClick?.(node.id)}
        fitView
      >
        <Background color="#f59e0b" gap={20} size={1} />
        <Controls />
        <MiniMap nodeColor="#f59e0b" />
      </ReactFlow>
    </div>
  )
}
```

- [ ] **Step 3: Tree view page (stub data)**

```tsx
// app/(dashboard)/trees/[treeId]/page.tsx
'use client'
import { FamilyTree } from '@/components/tree/FamilyTree'
import type { TreeNode, TreeEdge } from '@/types'

const stubNodes: TreeNode[] = [
  {
    id: '1',
    type: 'personNode',
    position: { x: 300, y: 50 },
    data: { person: { _id: '1', treeId: 'x', firstName: 'John', lastName: 'Smith', gender: 'male', isLiving: false, createdAt: new Date(), updatedAt: new Date() } },
  },
  {
    id: '2',
    type: 'personNode',
    position: { x: 100, y: 200 },
    data: { person: { _id: '2', treeId: 'x', firstName: 'Mary', lastName: 'Smith', gender: 'female', isLiving: true, createdAt: new Date(), updatedAt: new Date() } },
  },
]
const stubEdges: TreeEdge[] = [
  { id: 'e1-2', source: '1', target: '2', type: 'step', label: 'parent' },
]

export default function TreePage({ params }: { params: { treeId: string } }) {
  return (
    <div className="flex flex-col gap-4 h-full">
      <h1 className="text-2xl font-bold">Family Tree</h1>
      <FamilyTree
        nodes={stubNodes}
        edges={stubEdges}
        onNodeClick={id => console.log('clicked', id)}
      />
    </div>
  )
}
```

- [ ] **Step 4: Verify tree renders**

Visit http://localhost:3000/trees/test. Expect: React Flow canvas with 2 person nodes connected.

- [ ] **Step 5: Commit**

```bash
git add components/tree/ app/(dashboard)/trees/
git commit -m "feat: add React Flow family tree canvas with PersonNode"
```

---

## Phase 2: Backend + Mongoose

### Task 8: DB connection + Mongoose models

**Files:**
- Create: `lib/db.ts`
- Create: `models/User.ts`
- Create: `models/Tree.ts`
- Create: `models/Person.ts`
- Create: `models/Event.ts`
- Create: `models/Relationship.ts`

- [ ] **Step 1: DB singleton**

```typescript
// lib/db.ts
import mongoose from 'mongoose'

const MONGODB_URI = process.env.MONGODB_URI!

if (!MONGODB_URI) throw new Error('MONGODB_URI env var not set')

declare global {
  var mongoose: { conn: typeof import('mongoose') | null; promise: Promise<typeof import('mongoose')> | null }
}

let cached = global.mongoose ?? { conn: null, promise: null }
global.mongoose = cached

export async function connectDB() {
  if (cached.conn) return cached.conn
  if (!cached.promise) {
    cached.promise = mongoose.connect(MONGODB_URI, { bufferCommands: false }).then(m => m)
  }
  cached.conn = await cached.promise
  return cached.conn
}
```

- [ ] **Step 2: User model**

```typescript
// models/User.ts
import mongoose, { Schema, type Document } from 'mongoose'

export interface IUserDoc extends Document {
  name: string
  email: string
  password?: string
  image?: string
  emailVerified?: Date
  createdAt: Date
}

const UserSchema = new Schema<IUserDoc>({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true, lowercase: true },
  password: String,
  image: String,
  emailVerified: Date,
}, { timestamps: true })

export const User = mongoose.models.User || mongoose.model<IUserDoc>('User', UserSchema)
```

- [ ] **Step 3: Tree model**

```typescript
// models/Tree.ts
import mongoose, { Schema, type Document } from 'mongoose'

export interface ITreeDoc extends Document {
  name: string
  description?: string
  ownerId: mongoose.Types.ObjectId
  isPublic: boolean
  createdAt: Date
  updatedAt: Date
}

const TreeSchema = new Schema<ITreeDoc>({
  name: { type: String, required: true },
  description: String,
  ownerId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  isPublic: { type: Boolean, default: false },
}, { timestamps: true })

export const Tree = mongoose.models.Tree || mongoose.model<ITreeDoc>('Tree', TreeSchema)
```

- [ ] **Step 4: Person model**

```typescript
// models/Person.ts
import mongoose, { Schema, type Document } from 'mongoose'

export interface IPersonDoc extends Document {
  treeId: mongoose.Types.ObjectId
  firstName: string
  lastName: string
  maidenName?: string
  gender: 'male' | 'female' | 'other' | 'unknown'
  birthDate?: string
  birthPlace?: string
  deathDate?: string
  deathPlace?: string
  isLiving: boolean
  photoUrl?: string
  notes?: string
  bio?: string
  createdAt: Date
  updatedAt: Date
}

const PersonSchema = new Schema<IPersonDoc>({
  treeId: { type: Schema.Types.ObjectId, ref: 'Tree', required: true },
  firstName: { type: String, required: true },
  lastName: { type: String, required: true },
  maidenName: String,
  gender: { type: String, enum: ['male', 'female', 'other', 'unknown'], default: 'unknown' },
  birthDate: String,
  birthPlace: String,
  deathDate: String,
  deathPlace: String,
  isLiving: { type: Boolean, default: true },
  photoUrl: String,
  notes: String,
  bio: String,
}, { timestamps: true })

PersonSchema.index({ treeId: 1 })

export const Person = mongoose.models.Person || mongoose.model<IPersonDoc>('Person', PersonSchema)
```

- [ ] **Step 5: Event model**

```typescript
// models/Event.ts
import mongoose, { Schema, type Document } from 'mongoose'

export interface IEventDoc extends Document {
  personId: mongoose.Types.ObjectId
  type: 'birth' | 'death' | 'marriage' | 'divorce' | 'immigration' | 'other'
  date?: string
  place?: string
  description?: string
  documentUrls: string[]
}

const EventSchema = new Schema<IEventDoc>({
  personId: { type: Schema.Types.ObjectId, ref: 'Person', required: true },
  type: { type: String, enum: ['birth', 'death', 'marriage', 'divorce', 'immigration', 'other'], required: true },
  date: String,
  place: String,
  description: String,
  documentUrls: [String],
}, { timestamps: true })

EventSchema.index({ personId: 1 })

export const Event = mongoose.models.Event || mongoose.model<IEventDoc>('Event', EventSchema)
```

- [ ] **Step 6: Relationship model**

```typescript
// models/Relationship.ts
import mongoose, { Schema, type Document } from 'mongoose'

export interface IRelationshipDoc extends Document {
  treeId: mongoose.Types.ObjectId
  type: 'parent-child' | 'spouse'
  person1Id: mongoose.Types.ObjectId
  person2Id: mongoose.Types.ObjectId
  startDate?: string
  endDate?: string
}

const RelationshipSchema = new Schema<IRelationshipDoc>({
  treeId: { type: Schema.Types.ObjectId, ref: 'Tree', required: true },
  type: { type: String, enum: ['parent-child', 'spouse'], required: true },
  person1Id: { type: Schema.Types.ObjectId, ref: 'Person', required: true },
  person2Id: { type: Schema.Types.ObjectId, ref: 'Person', required: true },
  startDate: String,
  endDate: String,
}, { timestamps: true })

RelationshipSchema.index({ treeId: 1 })

export const Relationship = mongoose.models.Relationship || mongoose.model<IRelationshipDoc>('Relationship', RelationshipSchema)
```

- [ ] **Step 7: Commit**

```bash
git add lib/db.ts models/
git commit -m "feat: add Mongoose models and DB connection singleton"
```

---

### Task 9: Trees API routes

**Files:**
- Create: `app/api/trees/route.ts`
- Create: `app/api/trees/[treeId]/route.ts`

- [ ] **Step 1: Trees collection route (GET + POST)**

```typescript
// app/api/trees/route.ts
import { NextResponse } from 'next/server'
import { connectDB } from '@/lib/db'
import { Tree } from '@/models/Tree'

export async function GET(req: Request) {
  await connectDB()
  const { searchParams } = new URL(req.url)
  const ownerId = searchParams.get('ownerId')
  const filter = ownerId ? { ownerId } : { isPublic: true }
  const trees = await Tree.find(filter).sort({ updatedAt: -1 }).lean()
  return NextResponse.json(trees)
}

export async function POST(req: Request) {
  await connectDB()
  const body = await req.json()
  const { name, description, ownerId, isPublic } = body
  if (!name || !ownerId) {
    return NextResponse.json({ error: 'name and ownerId required' }, { status: 400 })
  }
  const tree = await Tree.create({ name, description, ownerId, isPublic: isPublic ?? false })
  return NextResponse.json(tree, { status: 201 })
}
```

- [ ] **Step 2: Single tree route (GET + PATCH + DELETE)**

```typescript
// app/api/trees/[treeId]/route.ts
import { NextResponse } from 'next/server'
import { connectDB } from '@/lib/db'
import { Tree } from '@/models/Tree'

export async function GET(_: Request, { params }: { params: { treeId: string } }) {
  await connectDB()
  const tree = await Tree.findById(params.treeId).lean()
  if (!tree) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(tree)
}

export async function PATCH(req: Request, { params }: { params: { treeId: string } }) {
  await connectDB()
  const body = await req.json()
  const allowed = ['name', 'description', 'isPublic']
  const update: Record<string, unknown> = {}
  for (const k of allowed) if (k in body) update[k] = body[k]
  const tree = await Tree.findByIdAndUpdate(params.treeId, update, { new: true }).lean()
  if (!tree) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(tree)
}

export async function DELETE(_: Request, { params }: { params: { treeId: string } }) {
  await connectDB()
  await Tree.findByIdAndDelete(params.treeId)
  return NextResponse.json({ success: true })
}
```

- [ ] **Step 3: Test endpoints manually**

```bash
# POST create tree
curl -X POST http://localhost:3000/api/trees \
  -H 'Content-Type: application/json' \
  -d '{"name":"Smith Family","ownerId":"507f1f77bcf86cd799439011"}'
```

Expected: `{"_id":"...","name":"Smith Family",...}` with status 201.

- [ ] **Step 4: Commit**

```bash
git add app/api/trees/
git commit -m "feat: add trees API routes (CRUD)"
```

---

### Task 10: Persons API routes

**Files:**
- Create: `app/api/trees/[treeId]/persons/route.ts`
- Create: `app/api/persons/[personId]/route.ts`
- Create: `app/api/persons/[personId]/relationships/route.ts`

- [ ] **Step 1: Persons for a tree (GET + POST)**

```typescript
// app/api/trees/[treeId]/persons/route.ts
import { NextResponse } from 'next/server'
import { connectDB } from '@/lib/db'
import { Person } from '@/models/Person'

export async function GET(_: Request, { params }: { params: { treeId: string } }) {
  await connectDB()
  const persons = await Person.find({ treeId: params.treeId }).lean()
  return NextResponse.json(persons)
}

export async function POST(req: Request, { params }: { params: { treeId: string } }) {
  await connectDB()
  const body = await req.json()
  if (!body.firstName || !body.lastName) {
    return NextResponse.json({ error: 'firstName and lastName required' }, { status: 400 })
  }
  const person = await Person.create({ ...body, treeId: params.treeId })
  return NextResponse.json(person, { status: 201 })
}
```

- [ ] **Step 2: Single person route**

```typescript
// app/api/persons/[personId]/route.ts
import { NextResponse } from 'next/server'
import { connectDB } from '@/lib/db'
import { Person } from '@/models/Person'

export async function GET(_: Request, { params }: { params: { personId: string } }) {
  await connectDB()
  const person = await Person.findById(params.personId).lean()
  if (!person) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(person)
}

export async function PATCH(req: Request, { params }: { params: { personId: string } }) {
  await connectDB()
  const body = await req.json()
  const allowed = ['firstName', 'lastName', 'maidenName', 'gender', 'birthDate', 'birthPlace',
    'deathDate', 'deathPlace', 'isLiving', 'photoUrl', 'notes', 'bio']
  const update: Record<string, unknown> = {}
  for (const k of allowed) if (k in body) update[k] = body[k]
  const person = await Person.findByIdAndUpdate(params.personId, update, { new: true }).lean()
  if (!person) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(person)
}

export async function DELETE(_: Request, { params }: { params: { personId: string } }) {
  await connectDB()
  await Person.findByIdAndDelete(params.personId)
  return NextResponse.json({ success: true })
}
```

- [ ] **Step 3: Relationships route**

```typescript
// app/api/persons/[personId]/relationships/route.ts
import { NextResponse } from 'next/server'
import { connectDB } from '@/lib/db'
import { Relationship } from '@/models/Relationship'

export async function GET(_: Request, { params }: { params: { personId: string } }) {
  await connectDB()
  const rels = await Relationship.find({
    $or: [{ person1Id: params.personId }, { person2Id: params.personId }],
  }).lean()
  return NextResponse.json(rels)
}

export async function POST(req: Request, { params }: { params: { personId: string } }) {
  await connectDB()
  const body = await req.json()
  const { treeId, type, person2Id, startDate, endDate } = body
  if (!treeId || !type || !person2Id) {
    return NextResponse.json({ error: 'treeId, type, person2Id required' }, { status: 400 })
  }
  const rel = await Relationship.create({
    treeId, type, person1Id: params.personId, person2Id, startDate, endDate,
  })
  return NextResponse.json(rel, { status: 201 })
}
```

- [ ] **Step 4: Commit**

```bash
git add app/api/trees/[treeId]/persons/ app/api/persons/
git commit -m "feat: add persons and relationships API routes"
```

---

### Task 11: SWR hooks for data fetching

**Files:**
- Create: `hooks/useTree.ts`
- Create: `hooks/usePerson.ts`

- [ ] **Step 1: Install SWR**

```bash
npm install swr
```

- [ ] **Step 2: useTree hook**

```typescript
// hooks/useTree.ts
import useSWR from 'swr'
import type { ITree } from '@/types'

const fetcher = (url: string) => fetch(url).then(r => r.json())

export function useTrees(ownerId?: string) {
  const url = ownerId ? `/api/trees?ownerId=${ownerId}` : null
  const { data, error, mutate } = useSWR<ITree[]>(url, fetcher)
  return { trees: data, loading: !error && !data, error, mutate }
}

export function useTree(treeId?: string) {
  const { data, error, mutate } = useSWR<ITree>(
    treeId ? `/api/trees/${treeId}` : null,
    fetcher
  )
  return { tree: data, loading: !error && !data, error, mutate }
}

export async function createTree(data: { name: string; description?: string; ownerId: string; isPublic?: boolean }) {
  const res = await fetch('/api/trees', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!res.ok) throw new Error(await res.text())
  return res.json() as Promise<ITree>
}
```

- [ ] **Step 3: usePerson hook**

```typescript
// hooks/usePerson.ts
import useSWR from 'swr'
import type { IPerson } from '@/types'

const fetcher = (url: string) => fetch(url).then(r => r.json())

export function usePersons(treeId?: string) {
  const { data, error, mutate } = useSWR<IPerson[]>(
    treeId ? `/api/trees/${treeId}/persons` : null,
    fetcher
  )
  return { persons: data, loading: !error && !data, error, mutate }
}

export function usePerson(personId?: string) {
  const { data, error, mutate } = useSWR<IPerson>(
    personId ? `/api/persons/${personId}` : null,
    fetcher
  )
  return { person: data, loading: !error && !data, error, mutate }
}

export async function createPerson(treeId: string, data: Partial<IPerson>) {
  const res = await fetch(`/api/trees/${treeId}/persons`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!res.ok) throw new Error(await res.text())
  return res.json() as Promise<IPerson>
}

export async function updatePerson(personId: string, data: Partial<IPerson>) {
  const res = await fetch(`/api/persons/${personId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!res.ok) throw new Error(await res.text())
  return res.json() as Promise<IPerson>
}
```

- [ ] **Step 4: Commit**

```bash
git add hooks/
git commit -m "feat: add SWR hooks for trees and persons"
```

---

### Task 12: Wire tree page to real data + AddPersonModal

**Files:**
- Create: `components/tree/AddPersonModal.tsx`
- Modify: `app/(dashboard)/trees/[treeId]/page.tsx`

- [ ] **Step 1: AddPersonModal**

```tsx
// components/tree/AddPersonModal.tsx
'use client'
import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { PersonForm } from '@/components/person/PersonForm'
import { createPerson } from '@/hooks/usePerson'
import type { IPerson } from '@/types'

interface Props {
  treeId: string
  onCreated: (person: IPerson) => void
}

export function AddPersonModal({ treeId, onCreated }: Props) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(data: Partial<IPerson>) {
    setLoading(true)
    try {
      const person = await createPerson(treeId, data)
      onCreated(person)
      setOpen(false)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>+ Add Person</Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add Person to Tree</DialogTitle>
        </DialogHeader>
        <PersonForm onSubmit={handleSubmit} loading={loading} />
      </DialogContent>
    </Dialog>
  )
}
```

- [ ] **Step 2: Update tree page with real data + tree-to-flow conversion**

```tsx
// app/(dashboard)/trees/[treeId]/page.tsx
'use client'
import { useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { FamilyTree } from '@/components/tree/FamilyTree'
import { AddPersonModal } from '@/components/tree/AddPersonModal'
import { usePersons } from '@/hooks/usePerson'
import type { IPerson, TreeNode, TreeEdge } from '@/types'

function personsToFlow(persons: IPerson[]): { nodes: TreeNode[]; edges: TreeEdge[] } {
  const nodes: TreeNode[] = persons.map((p, i) => ({
    id: p._id,
    type: 'personNode' as const,
    position: { x: (i % 4) * 220, y: Math.floor(i / 4) * 180 },
    data: { person: p },
  }))
  return { nodes, edges: [] }
}

export default function TreePage({ params }: { params: { treeId: string } }) {
  const { persons, mutate } = usePersons(params.treeId)
  const router = useRouter()

  const { nodes, edges } = personsToFlow(persons ?? [])

  const handlePersonCreated = useCallback(() => {
    mutate()
  }, [mutate])

  return (
    <div className="flex flex-col gap-4 h-full">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Family Tree</h1>
        <AddPersonModal treeId={params.treeId} onCreated={handlePersonCreated} />
      </div>
      <FamilyTree
        nodes={nodes}
        edges={edges}
        onNodeClick={id => router.push(`/person/${id}`)}
      />
    </div>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add components/tree/AddPersonModal.tsx app/(dashboard)/trees/[treeId]/page.tsx
git commit -m "feat: wire tree page to real API data with add person modal"
```

---

## Phase 3: Auth Module

### Task 13: NextAuth v5 setup

**Files:**
- Create: `lib/auth.ts`
- Create: `app/api/auth/[...nextauth]/route.ts`
- Create: `middleware.ts`

- [ ] **Step 1: NextAuth config**

```typescript
// lib/auth.ts
import NextAuth from 'next-auth'
import Google from 'next-auth/providers/google'
import Facebook from 'next-auth/providers/facebook'
import Credentials from 'next-auth/providers/credentials'
import Resend from 'next-auth/providers/resend'
import { MongoDBAdapter } from '@auth/mongodb-adapter'
import { MongoClient } from 'mongodb'
import bcrypt from 'bcryptjs'
import { connectDB } from './db'
import { User } from '@/models/User'

const client = new MongoClient(process.env.MONGODB_URI!)

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: MongoDBAdapter(client),
  session: { strategy: 'jwt' },
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
    Facebook({
      clientId: process.env.FACEBOOK_CLIENT_ID!,
      clientSecret: process.env.FACEBOOK_CLIENT_SECRET!,
    }),
    Resend({
      apiKey: process.env.RESEND_API_KEY!,
      from: 'noreply@familyroots.app',
    }),
    Credentials({
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        await connectDB()
        const user = await User.findOne({ email: credentials.email }).select('+password')
        if (!user || !user.password) return null
        const valid = await bcrypt.compare(credentials.password as string, user.password)
        if (!valid) return null
        return { id: user._id.toString(), name: user.name, email: user.email, image: user.image }
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) token.id = user.id
      return token
    },
    session({ session, token }) {
      session.user.id = token.id as string
      return session
    },
  },
  pages: {
    signIn: '/login',
    error: '/login',
  },
})
```

- [ ] **Step 2: Install auth deps**

```bash
npm install bcryptjs mongodb @auth/mongodb-adapter
npm install -D @types/bcryptjs
```

- [ ] **Step 3: Auth route handler**

```typescript
// app/api/auth/[...nextauth]/route.ts
import { handlers } from '@/lib/auth'
export const { GET, POST } = handlers
```

- [ ] **Step 4: Middleware to protect dashboard**

```typescript
// middleware.ts
import { auth } from '@/lib/auth'

export default auth((req) => {
  const isLoggedIn = !!req.auth
  const isDashboard = req.nextUrl.pathname.startsWith('/dashboard') ||
    req.nextUrl.pathname.startsWith('/trees') ||
    req.nextUrl.pathname.startsWith('/person')
  if (isDashboard && !isLoggedIn) {
    return Response.redirect(new URL('/login', req.nextUrl))
  }
})

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
}
```

- [ ] **Step 5: Commit**

```bash
git add lib/auth.ts app/api/auth/ middleware.ts
git commit -m "feat: add NextAuth v5 with Google, Facebook, magic link, and credentials providers"
```

---

### Task 14: Wire auth to UI + registration API

**Files:**
- Modify: `app/(auth)/login/page.tsx`
- Modify: `app/(auth)/register/page.tsx`
- Create: `app/api/auth/register/route.ts`
- Modify: `components/layout/Navbar.tsx`

- [ ] **Step 1: Registration API**

```typescript
// app/api/auth/register/route.ts
import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { connectDB } from '@/lib/db'
import { User } from '@/models/User'

export async function POST(req: Request) {
  await connectDB()
  const { name, email, password } = await req.json()
  if (!name || !email || !password) {
    return NextResponse.json({ error: 'All fields required' }, { status: 400 })
  }
  const exists = await User.findOne({ email })
  if (exists) {
    return NextResponse.json({ error: 'Email already registered' }, { status: 409 })
  }
  const hash = await bcrypt.hash(password, 12)
  const user = await User.create({ name, email, password: hash })
  return NextResponse.json({ id: user._id, name: user.name, email: user.email }, { status: 201 })
}
```

- [ ] **Step 2: Wire login form to signIn**

```tsx
// app/(auth)/login/page.tsx
'use client'
import { useState } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const result = await signIn('credentials', { email, password, redirect: false })
    if (result?.error) {
      setError('Invalid email or password')
    } else {
      router.push('/dashboard')
    }
    setLoading(false)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Welcome back</CardTitle>
        <CardDescription>Sign in to your FamilyRoots account</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Button variant="outline" onClick={() => signIn('google', { callbackUrl: '/dashboard' })}>Google</Button>
          <Button variant="outline" onClick={() => signIn('facebook', { callbackUrl: '/dashboard' })}>Facebook</Button>
        </div>
        <div className="relative">
          <div className="absolute inset-0 flex items-center"><span className="w-full border-t" /></div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-white px-2 text-muted-foreground">Or with email</span>
          </div>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && <p className="text-sm text-red-500">{error}</p>}
          <div className="space-y-2">
            <Label>Email</Label>
            <Input type="email" value={email} onChange={e => setEmail(e.target.value)} required />
          </div>
          <div className="space-y-2">
            <Label>Password</Label>
            <Input type="password" value={password} onChange={e => setPassword(e.target.value)} required />
          </div>
          <Button className="w-full" type="submit" disabled={loading}>
            {loading ? 'Signing in...' : 'Sign in'}
          </Button>
        </form>
        <p className="text-center text-sm text-muted-foreground">
          No account? <Link href="/register" className="underline">Register</Link>
        </p>
      </CardContent>
    </Card>
  )
}
```

- [ ] **Step 3: Wire register form**

```tsx
// app/(auth)/register/page.tsx
'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { signIn } from 'next-auth/react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export default function RegisterPage() {
  const router = useRouter()
  const [form, setForm] = useState({ name: '', email: '', password: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    if (!res.ok) {
      const data = await res.json()
      setError(data.error)
      setLoading(false)
      return
    }
    await signIn('credentials', { email: form.email, password: form.password, redirect: false })
    router.push('/dashboard')
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Create account</CardTitle>
        <CardDescription>Start building your family tree for free</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Button variant="outline" onClick={() => signIn('google', { callbackUrl: '/dashboard' })}>Google</Button>
          <Button variant="outline" onClick={() => signIn('facebook', { callbackUrl: '/dashboard' })}>Facebook</Button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && <p className="text-sm text-red-500">{error}</p>}
          <div className="space-y-2">
            <Label>Full name</Label>
            <Input value={form.name} onChange={e => setForm(p => ({...p, name: e.target.value}))} required />
          </div>
          <div className="space-y-2">
            <Label>Email</Label>
            <Input type="email" value={form.email} onChange={e => setForm(p => ({...p, email: e.target.value}))} required />
          </div>
          <div className="space-y-2">
            <Label>Password</Label>
            <Input type="password" value={form.password} onChange={e => setForm(p => ({...p, password: e.target.value}))} required />
          </div>
          <Button className="w-full" type="submit" disabled={loading}>
            {loading ? 'Creating...' : 'Create account'}
          </Button>
        </form>
        <p className="text-center text-sm text-muted-foreground">
          Have account? <Link href="/login" className="underline">Sign in</Link>
        </p>
      </CardContent>
    </Card>
  )
}
```

- [ ] **Step 4: Update Navbar with real session**

```tsx
// components/layout/Navbar.tsx
import Link from 'next/link'
import { auth, signOut } from '@/lib/auth'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'

export async function Navbar() {
  const session = await auth()
  const user = session?.user
  const initials = user?.name?.split(' ').map(n => n[0]).join('').slice(0, 2) ?? 'U'

  return (
    <header className="h-14 border-b bg-white flex items-center justify-between px-6">
      <Link href="/dashboard" className="text-xl font-bold text-amber-800">FamilyRoots</Link>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="relative h-9 w-9 rounded-full">
            <Avatar className="h-9 w-9">
              <AvatarImage src={user?.image ?? ''} />
              <AvatarFallback>{initials}</AvatarFallback>
            </Avatar>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem className="text-sm text-muted-foreground" disabled>
            {user?.email}
          </DropdownMenuItem>
          <form action={async () => { 'use server'; await signOut({ redirectTo: '/login' }) }}>
            <DropdownMenuItem asChild>
              <button type="submit" className="w-full text-left">Sign out</button>
            </DropdownMenuItem>
          </form>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  )
}
```

- [ ] **Step 5: Add SessionProvider to root layout**

```tsx
// app/layout.tsx
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import { SessionProvider } from 'next-auth/react'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'FamilyRoots — Discover Your Family History',
  description: 'Build, explore, and share your family tree with AI-powered tools',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <SessionProvider>{children}</SessionProvider>
      </body>
    </html>
  )
}
```

- [ ] **Step 6: Test full auth flow**

1. Visit http://localhost:3000/register
2. Create account with email/password
3. Expect redirect to /dashboard
4. Click sign out → expect redirect to /login
5. Sign in again → expect /dashboard

- [ ] **Step 7: Commit**

```bash
git add app/(auth)/ app/api/auth/ components/layout/Navbar.tsx app/layout.tsx
git commit -m "feat: wire full auth flow — credentials, Google, Facebook, magic link"
```

---

## Phase 4: AI Integration

### Task 15: Story generation API

**Files:**
- Create: `app/api/ai/story/route.ts`
- Create: `components/ai/StoryDisplay.tsx`
- Modify: `app/(dashboard)/person/[personId]/page.tsx` (create if not exists)

- [ ] **Step 1: Story generation API**

```typescript
// app/api/ai/story/route.ts
import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { connectDB } from '@/lib/db'
import { Person } from '@/models/Person'
import { Event } from '@/models/Event'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

export async function POST(req: Request) {
  await connectDB()
  const { personId } = await req.json()
  if (!personId) return NextResponse.json({ error: 'personId required' }, { status: 400 })

  const [person, events] = await Promise.all([
    Person.findById(personId).lean(),
    Event.find({ personId }).lean(),
  ])

  if (!person) return NextResponse.json({ error: 'Person not found' }, { status: 404 })

  const eventText = events.map(e =>
    `${e.type} on ${e.date ?? 'unknown date'}${e.place ? ` in ${e.place}` : ''}${e.description ? `: ${e.description}` : ''}`
  ).join('\n')

  const prompt = `Write a short, warm biographical paragraph (150-200 words) about ${person.firstName} ${person.lastName}.

Facts:
- Born: ${person.birthDate ?? 'unknown'} ${person.birthPlace ? `in ${person.birthPlace}` : ''}
- Gender: ${person.gender}
${person.deathDate ? `- Died: ${person.deathDate} ${person.deathPlace ? `in ${person.deathPlace}` : ''}` : '- Still living'}
${person.notes ? `- Notes: ${person.notes}` : ''}
${eventText ? `\nLife events:\n${eventText}` : ''}

Write in third person. Tone: warm, respectful, like a family history book. Fill in plausible historical context based on the dates and places. Mark speculative details with "(likely)" or "(probably)".`

  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 400,
    messages: [{ role: 'user', content: prompt }],
  })

  const bio = (message.content[0] as { type: 'text'; text: string }).text

  await Person.findByIdAndUpdate(personId, { bio })

  return NextResponse.json({ bio })
}
```

- [ ] **Step 2: StoryDisplay component**

```tsx
// components/ai/StoryDisplay.tsx
'use client'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Sparkles } from 'lucide-react'

interface Props {
  personId: string
  initialBio?: string
  onGenerated?: (bio: string) => void
}

export function StoryDisplay({ personId, initialBio, onGenerated }: Props) {
  const [bio, setBio] = useState(initialBio ?? '')
  const [loading, setLoading] = useState(false)

  async function generate() {
    setLoading(true)
    const res = await fetch('/api/ai/story', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ personId }),
    })
    const data = await res.json()
    setBio(data.bio)
    onGenerated?.(data.bio)
    setLoading(false)
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-base">Biography</CardTitle>
        <Button size="sm" variant="outline" onClick={generate} disabled={loading}>
          <Sparkles className="h-4 w-4 mr-1" />
          {loading ? 'Generating...' : bio ? 'Regenerate' : 'Generate with AI'}
        </Button>
      </CardHeader>
      <CardContent>
        {bio ? (
          <p className="text-sm text-gray-700 leading-relaxed">{bio}</p>
        ) : (
          <p className="text-sm text-muted-foreground italic">No biography yet. Click "Generate with AI" to create one.</p>
        )}
      </CardContent>
    </Card>
  )
}
```

- [ ] **Step 3: Person profile page**

```tsx
// app/(dashboard)/person/[personId]/page.tsx
import { connectDB } from '@/lib/db'
import { Person } from '@/models/Person'
import { Event } from '@/models/Event'
import { StoryDisplay } from '@/components/ai/StoryDisplay'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'

export default async function PersonPage({ params }: { params: { personId: string } }) {
  await connectDB()
  const [person, events] = await Promise.all([
    Person.findById(params.personId).lean(),
    Event.find({ personId: params.personId }).lean(),
  ])

  if (!person) return <div>Person not found</div>

  const initials = `${person.firstName[0]}${person.lastName[0]}`

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center gap-4">
        <Avatar className="h-20 w-20">
          <AvatarImage src={person.photoUrl} />
          <AvatarFallback className="text-2xl">{initials}</AvatarFallback>
        </Avatar>
        <div>
          <h1 className="text-2xl font-bold">{person.firstName} {person.lastName}</h1>
          {person.maidenName && <p className="text-muted-foreground">née {person.maidenName}</p>}
          <div className="flex gap-2 mt-1">
            <Badge variant="outline">{person.gender}</Badge>
            {!person.isLiving && <Badge variant="secondary">Deceased</Badge>}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 text-sm">
        {person.birthDate && (
          <div><span className="font-medium">Born:</span> {person.birthDate} {person.birthPlace && `· ${person.birthPlace}`}</div>
        )}
        {person.deathDate && (
          <div><span className="font-medium">Died:</span> {person.deathDate} {person.deathPlace && `· ${person.deathPlace}`}</div>
        )}
      </div>

      <StoryDisplay personId={params.personId} initialBio={person.bio} />

      {events.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold mb-3">Life Events</h2>
          <div className="space-y-2">
            {events.map(e => (
              <div key={e._id.toString()} className="flex gap-3 text-sm p-3 bg-gray-50 rounded-lg">
                <Badge variant="outline" className="shrink-0">{e.type}</Badge>
                <span>{e.date ?? 'Unknown date'}{e.place ? ` · ${e.place}` : ''}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Test story generation**

1. Create a person via the tree page
2. Navigate to `/person/{id}`
3. Click "Generate with AI"
4. Expect: paragraph bio appears within ~5 seconds

- [ ] **Step 5: Commit**

```bash
git add app/api/ai/story/ components/ai/StoryDisplay.tsx app/(dashboard)/person/
git commit -m "feat: AI story generation with Anthropic Claude"
```

---

### Task 16: Document OCR

**Files:**
- Create: `app/api/ai/ocr/route.ts`
- Create: `components/ai/OCRUploader.tsx`

- [ ] **Step 1: OCR API route (Tesseract.js server-side)**

```typescript
// app/api/ai/ocr/route.ts
import { NextResponse } from 'next/server'
import Tesseract from 'tesseract.js'
import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

export async function POST(req: Request) {
  const formData = await req.formData()
  const file = formData.get('file') as File
  if (!file) return NextResponse.json({ error: 'file required' }, { status: 400 })

  const buffer = Buffer.from(await file.arrayBuffer())

  const { data: { text } } = await Tesseract.recognize(buffer, 'eng', { logger: () => {} })

  if (!text.trim()) {
    return NextResponse.json({ rawText: '', extracted: null })
  }

  const message = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 300,
    messages: [{
      role: 'user',
      content: `From this OCR text of a genealogy document, extract structured data as JSON.

OCR text:
${text.slice(0, 2000)}

Return ONLY valid JSON with these fields (null if not found):
{
  "firstName": null,
  "lastName": null,
  "birthDate": null,
  "birthPlace": null,
  "deathDate": null,
  "deathPlace": null,
  "eventType": null,
  "eventDate": null,
  "eventPlace": null,
  "notes": null
}`,
    }],
  })

  let extracted = null
  try {
    const responseText = (message.content[0] as { type: 'text'; text: string }).text
    extracted = JSON.parse(responseText.match(/\{[\s\S]*\}/)?.[0] ?? 'null')
  } catch {
    // OCR text not parseable as structured data — return raw text only
  }

  return NextResponse.json({ rawText: text, extracted })
}
```

- [ ] **Step 2: OCRUploader component**

```tsx
// components/ai/OCRUploader.tsx
'use client'
import { useState, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Upload } from 'lucide-react'
import type { IPerson } from '@/types'

interface ExtractedData extends Partial<IPerson> {
  eventType?: string
  eventDate?: string
  eventPlace?: string
}

interface Props {
  onExtracted?: (data: ExtractedData) => void
}

export function OCRUploader({ onExtracted }: Props) {
  const [loading, setLoading] = useState(false)
  const [extracted, setExtracted] = useState<ExtractedData | null>(null)
  const [rawText, setRawText] = useState('')

  const handleFile = useCallback(async (file: File) => {
    setLoading(true)
    const formData = new FormData()
    formData.append('file', file)
    const res = await fetch('/api/ai/ocr', { method: 'POST', body: formData })
    const data = await res.json()
    setRawText(data.rawText)
    setExtracted(data.extracted)
    if (data.extracted) onExtracted?.(data.extracted)
    setLoading(false)
  }, [onExtracted])

  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Document OCR</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <label className="flex flex-col items-center justify-center border-2 border-dashed rounded-lg p-8 cursor-pointer hover:border-amber-400 transition-colors">
          <Upload className="h-8 w-8 text-muted-foreground mb-2" />
          <span className="text-sm text-muted-foreground">
            {loading ? 'Processing...' : 'Upload birth certificate, marriage record, etc.'}
          </span>
          <input
            type="file"
            className="hidden"
            accept="image/*,.pdf"
            onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])}
            disabled={loading}
          />
        </label>

        {extracted && (
          <div className="space-y-2">
            <p className="text-sm font-medium">Extracted data:</p>
            {Object.entries(extracted).filter(([, v]) => v).map(([k, v]) => (
              <div key={k} className="flex gap-2 text-sm">
                <Badge variant="outline" className="shrink-0">{k}</Badge>
                <span>{String(v)}</span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add app/api/ai/ocr/ components/ai/OCRUploader.tsx
git commit -m "feat: document OCR with Tesseract.js + Claude data extraction"
```

---

### Task 17: DNA/GEDCOM matching

**Files:**
- Create: `app/api/ai/dna/route.ts`
- Create: `components/ai/DNAMatcher.tsx`
- Create: `app/(dashboard)/dna/page.tsx`

- [ ] **Step 1: GEDCOM parse + matching API**

```typescript
// app/api/ai/dna/route.ts
import { NextResponse } from 'next/server'
import { connectDB } from '@/lib/db'
import { Person } from '@/models/Person'
import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

function parseGEDCOM(text: string): Array<{ name: string; birth?: string; death?: string }> {
  const individuals: Array<{ name: string; birth?: string; death?: string }> = []
  const lines = text.split('\n')
  let current: { name?: string; birth?: string; death?: string } | null = null
  let inBirt = false
  let inDeat = false

  for (const line of lines) {
    const parts = line.trim().split(' ')
    const level = parts[0]
    const tag = parts[1]
    const value = parts.slice(2).join(' ')

    if (level === '0' && tag?.startsWith('@') && parts[2] === 'INDI') {
      if (current?.name) individuals.push(current as { name: string; birth?: string; death?: string })
      current = {}
      inBirt = false; inDeat = false
    } else if (level === '1') {
      inBirt = tag === 'BIRT'
      inDeat = tag === 'DEAT'
      if (tag === 'NAME' && current) current.name = value.replace(/\//g, '').trim()
    } else if (level === '2' && tag === 'DATE') {
      if (inBirt && current) current.birth = value
      if (inDeat && current) current.death = value
    }
  }
  if (current?.name) individuals.push(current as { name: string; birth?: string; death?: string })
  return individuals
}

export async function POST(req: Request) {
  await connectDB()
  const formData = await req.formData()
  const file = formData.get('file') as File
  const userId = formData.get('userId') as string

  if (!file || !userId) {
    return NextResponse.json({ error: 'file and userId required' }, { status: 400 })
  }

  const text = await file.text()
  const gedcomPersons = parseGEDCOM(text)

  const dbPersons = await Person.find({}).lean()

  const gedcomSummary = gedcomPersons.slice(0, 20).map(p =>
    `${p.name}${p.birth ? ` (b. ${p.birth})` : ''}${p.death ? ` (d. ${p.death})` : ''}`
  ).join('\n')

  const dbSummary = dbPersons.slice(0, 20).map(p =>
    `${p.firstName} ${p.lastName}${p.birthDate ? ` (b. ${p.birthDate})` : ''}${p.deathDate ? ` (d. ${p.deathDate})` : ''}`
  ).join('\n')

  const message = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 500,
    messages: [{
      role: 'user',
      content: `Compare these two lists of people from family trees and find likely matches.

Uploaded GEDCOM persons:
${gedcomSummary}

Database persons:
${dbSummary}

Return JSON array of matches:
[{"gedcom": "full name from gedcom", "database": "full name from database", "confidence": "high|medium|low", "reason": "brief reason"}]
Return empty array if no matches found. Return ONLY the JSON array.`,
    }],
  })

  let matches = []
  try {
    const responseText = (message.content[0] as { type: 'text'; text: string }).text
    matches = JSON.parse(responseText.match(/\[[\s\S]*\]/)?.[0] ?? '[]')
  } catch {
    // no parseable matches
  }

  return NextResponse.json({
    imported: gedcomPersons.length,
    matches,
    persons: gedcomPersons.slice(0, 50),
  })
}
```

- [ ] **Step 2: DNAMatcher component**

```tsx
// components/ai/DNAMatcher.tsx
'use client'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Upload } from 'lucide-react'
import { useSession } from 'next-auth/react'

interface Match {
  gedcom: string
  database: string
  confidence: 'high' | 'medium' | 'low'
  reason: string
}

interface Result {
  imported: number
  matches: Match[]
}

export function DNAMatcher() {
  const { data: session } = useSession()
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<Result | null>(null)

  async function handleFile(file: File) {
    setLoading(true)
    const formData = new FormData()
    formData.append('file', file)
    formData.append('userId', session?.user?.id ?? '')
    const res = await fetch('/api/ai/dna', { method: 'POST', body: formData })
    setResult(await res.json())
    setLoading(false)
  }

  const confidenceColor = (c: string) =>
    c === 'high' ? 'default' : c === 'medium' ? 'secondary' : 'outline'

  return (
    <Card>
      <CardHeader><CardTitle>GEDCOM / DNA Matching</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <label className="flex flex-col items-center justify-center border-2 border-dashed rounded-lg p-8 cursor-pointer hover:border-amber-400 transition-colors">
          <Upload className="h-8 w-8 text-muted-foreground mb-2" />
          <span className="text-sm text-muted-foreground">
            {loading ? 'Analyzing...' : 'Upload a .ged GEDCOM file'}
          </span>
          <input
            type="file"
            className="hidden"
            accept=".ged,.gedcom"
            onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])}
            disabled={loading}
          />
        </label>

        {result && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Found {result.imported} people in GEDCOM file
            </p>
            {result.matches.length > 0 ? (
              <div className="space-y-2">
                <p className="text-sm font-medium">Potential matches:</p>
                {result.matches.map((m, i) => (
                  <div key={i} className="p-3 bg-gray-50 rounded-lg text-sm space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{m.gedcom} ↔ {m.database}</span>
                      <Badge variant={confidenceColor(m.confidence)}>{m.confidence}</Badge>
                    </div>
                    <p className="text-muted-foreground">{m.reason}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No matching people found in your trees.</p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
```

- [ ] **Step 3: DNA page**

```tsx
// app/(dashboard)/dna/page.tsx
import { DNAMatcher } from '@/components/ai/DNAMatcher'

export default function DNAPage() {
  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold">DNA & GEDCOM Matching</h1>
      <p className="text-muted-foreground text-sm">
        Upload a GEDCOM file exported from another genealogy app to find overlapping ancestors in your trees.
      </p>
      <DNAMatcher />
    </div>
  )
}
```

- [ ] **Step 4: Commit**

```bash
git add app/api/ai/dna/ components/ai/DNAMatcher.tsx app/(dashboard)/dna/
git commit -m "feat: GEDCOM import and AI-powered DNA/ancestry matching"
```

---

## Phase 5: Polish + Public Trees

### Task 18: Public tree discovery + sharing

**Files:**
- Create: `app/public/trees/page.tsx`
- Create: `app/public/trees/[treeId]/page.tsx`
- Modify: `app/(dashboard)/trees/[treeId]/page.tsx` — add share toggle

- [ ] **Step 1: Public tree listing**

```tsx
// app/public/trees/page.tsx
import Link from 'next/link'
import { connectDB } from '@/lib/db'
import { Tree } from '@/models/Tree'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export default async function PublicTreesPage() {
  await connectDB()
  const trees = await Tree.find({ isPublic: true }).sort({ updatedAt: -1 }).limit(50).lean()

  return (
    <div className="max-w-4xl mx-auto py-12 px-4">
      <h1 className="text-3xl font-bold mb-2">Public Family Trees</h1>
      <p className="text-muted-foreground mb-8">Browse family trees shared by our community.</p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {trees.map(tree => (
          <Link key={tree._id.toString()} href={`/public/trees/${tree._id}`}>
            <Card className="hover:shadow-md transition-shadow cursor-pointer">
              <CardHeader>
                <CardTitle className="text-lg">{tree.name}</CardTitle>
                {tree.description && <CardDescription>{tree.description}</CardDescription>}
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground">
                  Updated {new Date(tree.updatedAt).toLocaleDateString()}
                </p>
              </CardContent>
            </Card>
          </Link>
        ))}
        {trees.length === 0 && (
          <p className="text-muted-foreground col-span-2">No public trees yet.</p>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Public tree view (read-only)**

```tsx
// app/public/trees/[treeId]/page.tsx
import { connectDB } from '@/lib/db'
import { Tree } from '@/models/Tree'
import { Person } from '@/models/Person'
import { notFound } from 'next/navigation'

export default async function PublicTreePage({ params }: { params: { treeId: string } }) {
  await connectDB()
  const tree = await Tree.findOne({ _id: params.treeId, isPublic: true }).lean()
  if (!tree) notFound()

  const persons = await Person.find({ treeId: params.treeId }).lean()

  return (
    <div className="max-w-4xl mx-auto py-12 px-4">
      <h1 className="text-3xl font-bold mb-2">{tree.name}</h1>
      {tree.description && <p className="text-muted-foreground mb-6">{tree.description}</p>}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {persons.map(p => (
          <div key={p._id.toString()} className="bg-white border rounded-xl p-4 text-center shadow-sm">
            <p className="font-semibold text-sm">{p.firstName} {p.lastName}</p>
            {p.birthDate && <p className="text-xs text-muted-foreground">b. {p.birthDate}</p>}
          </div>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add app/public/
git commit -m "feat: public tree discovery and read-only view"
```

---

### Task 19: Final wiring + env checklist

- [ ] **Step 1: Verify all required env vars are set in .env.local**

```
MONGODB_URI=
NEXTAUTH_SECRET=
NEXTAUTH_URL=
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
FACEBOOK_CLIENT_ID=
FACEBOOK_CLIENT_SECRET=
ANTHROPIC_API_KEY=
RESEND_API_KEY=
```

- [ ] **Step 2: Build check**

```bash
npm run build
```

Expected: no TypeScript errors, build succeeds.

- [ ] **Step 3: Add .gitignore entry**

Ensure `.env.local` is in `.gitignore` (Next.js scaffold does this by default — verify).

```bash
cat .gitignore | grep env
```

Expected: `.env*.local` appears.

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "feat: complete genealogy platform — frontend, backend, auth, AI features"
```

---

## Summary

| Phase | Tasks | Key output |
|-------|-------|-----------|
| 1 Frontend | 1–7 | Landing, auth pages, dashboard, tree canvas, person components |
| 2 Backend | 8–12 | Mongoose models, REST API routes, SWR hooks |
| 3 Auth | 13–14 | NextAuth v5 — email, Google, Facebook, magic link |
| 4 AI | 15–17 | Story gen (Claude), OCR (Tesseract + Claude), DNA/GEDCOM matching |
| 5 Polish | 18–19 | Public tree discovery, sharing toggle, build verification |
