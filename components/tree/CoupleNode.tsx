"use client";
import { Handle, Position, type Node, type NodeProps } from "@xyflow/react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import type { IPerson, RelativeRole } from "@/types";

export type CoupleNodeType = Node<
  {
    person1: IPerson;
    person2: IPerson;
    onAddRelative?: (personId: string, role: RelativeRole) => void;
    onSelect?: (person: IPerson) => void;
  },
  "coupleNode"
>;

const genderBorder: Record<string, string> = {
  male:    "border-blue-300",
  female:  "border-pink-300",
  other:   "border-purple-300",
  unknown: "border-gray-200",
};

const genderSelectedBorder: Record<string, string> = {
  male:    "border-blue-500",
  female:  "border-pink-500",
  other:   "border-purple-500",
  unknown: "border-amber-500",
};

const genderAvatar: Record<string, string> = {
  male:    "bg-blue-50 text-blue-700",
  female:  "bg-pink-50 text-pink-700",
  other:   "bg-purple-50 text-purple-700",
  unknown: "bg-gray-50 text-gray-600",
};

function PersonCard({
  person,
  selected,
  onClick,
}: {
  person: IPerson;
  selected: boolean;
  onClick: () => void;
}) {
  const initials = `${person.firstName[0] ?? "?"}${person.lastName[0] ?? ""}`;
  const gender = person.gender ?? "unknown";

  return (
    <div
      className={`bg-white border-2 rounded-xl shadow-sm w-40 cursor-pointer select-none transition-all ${
        selected
          ? `${genderSelectedBorder[gender]} shadow-md`
          : `${genderBorder[gender]} hover:shadow-md`
      }`}
      onClick={(e) => { e.stopPropagation(); onClick(); }}
    >
      <div className={`h-1 rounded-t-xl ${person.isLiving ? "bg-green-400" : "bg-gray-300"}`} />
      <div className="px-3 py-2.5 flex items-center gap-2.5">
        <div className="relative flex-shrink-0">
          <Avatar className="h-11 w-11">
            <AvatarImage src={person.photoUrl} />
            <AvatarFallback className={`text-sm font-semibold ${genderAvatar[gender]}`}>
              {initials}
            </AvatarFallback>
          </Avatar>
          <span
            className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-white ${
              person.isLiving ? "bg-green-400" : "bg-gray-400"
            }`}
          />
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-xs leading-tight truncate">{person.firstName}</p>
          <p className="text-xs text-gray-600 leading-tight truncate">{person.lastName}</p>
          {(person.birthDate || person.deathDate) && (
            <p className="text-[10px] text-gray-400 leading-tight mt-0.5 truncate">
              {person.birthDate ?? "?"}
              {!person.isLiving && person.deathDate ? `–${person.deathDate}` : ""}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function MarriageLine() {
  return (
    <div className="flex items-center w-[60px] flex-shrink-0">
      <div className="flex-1 h-[1.5px] bg-amber-400" />
      <span className="text-amber-500 text-sm mx-1 leading-none select-none">♥</span>
      <div className="flex-1 h-[1.5px] bg-amber-400" />
    </div>
  );
}

const CHILD_BUTTONS: { role: RelativeRole; label: string }[] = [
  { role: "son",      label: "Add son" },
  { role: "daughter", label: "Add daughter" },
];

export function CoupleNode({ data, selected }: NodeProps<CoupleNodeType>) {
  const { person1, person2, onAddRelative, onSelect } = data;

  return (
    <div className="relative">
      {/* 4 target handles: father(left) + mother(right) above each card */}
      {/* person1 card spans 0–160px, person2 card spans 220–380px */}
      <Handle type="target" position={Position.Top} id="person1-father" style={{ left: 40 }}  className="!bg-gray-300 !w-2 !h-2" />
      <Handle type="target" position={Position.Top} id="person1-mother" style={{ left: 120 }} className="!bg-gray-300 !w-2 !h-2" />
      <Handle type="target" position={Position.Top} id="person2-father" style={{ left: 260 }} className="!bg-gray-300 !w-2 !h-2" />
      <Handle type="target" position={Position.Top} id="person2-mother" style={{ left: 340 }} className="!bg-gray-300 !w-2 !h-2" />

      {selected && onAddRelative && (
        <>
          {/* person1 parents — stacked above left card */}
          <button
            className="nodrag nopan absolute -top-16 left-0 z-10 flex items-center gap-1 bg-white border border-gray-200 rounded-lg shadow px-2 py-1 text-[11px] font-medium text-gray-600 hover:border-amber-400 hover:text-amber-700 whitespace-nowrap"
            onClick={(e) => { e.stopPropagation(); onAddRelative(person1._id, "father"); }}
          >
            <span className="text-amber-500 font-bold">+</span> {person1.firstName}&apos;s father
          </button>
          <button
            className="nodrag nopan absolute -top-9 left-0 z-10 flex items-center gap-1 bg-white border border-gray-200 rounded-lg shadow px-2 py-1 text-[11px] font-medium text-gray-600 hover:border-amber-400 hover:text-amber-700 whitespace-nowrap"
            onClick={(e) => { e.stopPropagation(); onAddRelative(person1._id, "mother"); }}
          >
            <span className="text-amber-500 font-bold">+</span> {person1.firstName}&apos;s mother
          </button>
          {/* person2 parents — stacked above right card */}
          <button
            className="nodrag nopan absolute -top-16 right-0 z-10 flex items-center gap-1 bg-white border border-gray-200 rounded-lg shadow px-2 py-1 text-[11px] font-medium text-gray-600 hover:border-amber-400 hover:text-amber-700 whitespace-nowrap"
            onClick={(e) => { e.stopPropagation(); onAddRelative(person2._id, "father"); }}
          >
            <span className="text-amber-500 font-bold">+</span> {person2.firstName}&apos;s father
          </button>
          <button
            className="nodrag nopan absolute -top-9 right-0 z-10 flex items-center gap-1 bg-white border border-gray-200 rounded-lg shadow px-2 py-1 text-[11px] font-medium text-gray-600 hover:border-amber-400 hover:text-amber-700 whitespace-nowrap"
            onClick={(e) => { e.stopPropagation(); onAddRelative(person2._id, "mother"); }}
          >
            <span className="text-amber-500 font-bold">+</span> {person2.firstName}&apos;s mother
          </button>
        </>
      )}

      <div className="flex items-center">
        <PersonCard
          person={person1}
          selected={selected}
          onClick={() => onSelect?.(person1)}
        />
        <MarriageLine />
        <PersonCard
          person={person2}
          selected={selected}
          onClick={() => onSelect?.(person2)}
        />
      </div>

      {selected && onAddRelative && (
        <div className="absolute -bottom-9 left-0 right-0 flex justify-center gap-2 z-10">
          {CHILD_BUTTONS.map(({ role, label }) => (
            <button
              key={role}
              className="nodrag nopan flex items-center gap-1 bg-white border border-gray-200 rounded-lg shadow px-2 py-1 text-[11px] font-medium text-gray-600 hover:border-amber-400 hover:text-amber-700 whitespace-nowrap"
              onClick={(e) => { e.stopPropagation(); onAddRelative(person1._id, role); }}
            >
              <span className="text-amber-500 font-bold">+</span> {label}
            </button>
          ))}
        </div>
      )}

      <Handle type="source" position={Position.Bottom} className="!bg-gray-300 !w-2 !h-2" />
    </div>
  );
}
