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
