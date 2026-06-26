"use client";
import { Handle, Position, type Node, type NodeProps } from "@xyflow/react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ChevronUp, ChevronDown } from "lucide-react";
import type { IPerson, RelativeRole } from "@/types";

export type CoupleNodeType = Node<
  {
    person1: IPerson;
    person2: IPerson;
    onAddRelative?: (personId: string, role: RelativeRole, personId2?: string) => void;
    onSelect?: (person: IPerson) => void;
    isDivorced?: boolean;
    divorceDate?: string;
    onToggleCollapse?: (personId: string) => void;
    isCollapsed1?: boolean;
    isCollapsed2?: boolean;
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

function MarriageLine({ isDivorced, divorceDate }: { isDivorced?: boolean; divorceDate?: string }) {
  if (isDivorced) {
    return (
      <div className="flex flex-col items-center w-[60px] flex-shrink-0 gap-0.5">
        <div className="flex items-center w-full">
          <div className="flex-1 h-[1.5px] bg-gray-400 [background-image:repeating-linear-gradient(to_right,#9ca3af_0,#9ca3af_4px,transparent_4px,transparent_8px)]" />
          <span className="text-red-400 text-xs mx-1 leading-none select-none font-bold">÷</span>
          <div className="flex-1 h-[1.5px] bg-gray-400 [background-image:repeating-linear-gradient(to_right,#9ca3af_0,#9ca3af_4px,transparent_4px,transparent_8px)]" />
        </div>
        {divorceDate && (
          <span className="text-[9px] text-red-400 leading-none">{divorceDate}</span>
        )}
      </div>
    );
  }
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
  const { person1, person2, onAddRelative, onSelect, isDivorced, divorceDate, onToggleCollapse, isCollapsed1, isCollapsed2 } = data;

  return (
    <div className="relative">
      {/* 4 target handles: mother(left) + father(right) above each card */}
      {/* person1 card spans 0–160px, person2 card spans 220–380px */}
      <Handle type="target" position={Position.Top} id="person1-mother" style={{ left: 40 }}  className="!bg-gray-300 !w-2 !h-2" />
      <Handle type="target" position={Position.Top} id="person1-father" style={{ left: 120 }} className="!bg-gray-300 !w-2 !h-2" />
      <Handle type="target" position={Position.Top} id="person2-mother" style={{ left: 260 }} className="!bg-gray-300 !w-2 !h-2" />
      <Handle type="target" position={Position.Top} id="person2-father" style={{ left: 340 }} className="!bg-gray-300 !w-2 !h-2" />

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
          {/* Spouse buttons — positioned to outer sides of the couple node */}
          <button
            className="nodrag nopan absolute z-10 flex items-center gap-1 bg-white border border-gray-200 rounded-lg shadow px-2 py-1 text-[11px] font-medium text-gray-600 hover:border-amber-400 hover:text-amber-700 whitespace-nowrap"
            style={{ right: "calc(100% + 8px)", top: 20 }}
            onClick={(e) => { e.stopPropagation(); onAddRelative(person1._id, "spouse"); }}
          >
            <span className="text-amber-500 font-bold">+</span> {person1.firstName}&apos;s spouse
          </button>
          <button
            className="nodrag nopan absolute z-10 flex items-center gap-1 bg-white border border-gray-200 rounded-lg shadow px-2 py-1 text-[11px] font-medium text-gray-600 hover:border-amber-400 hover:text-amber-700 whitespace-nowrap"
            style={{ left: "calc(100% + 8px)", top: 20 }}
            onClick={(e) => { e.stopPropagation(); onAddRelative(person2._id, "spouse"); }}
          >
            <span className="text-amber-500 font-bold">+</span> {person2.firstName}&apos;s spouse
          </button>
        </>
      )}

      {/* Per-person collapse buttons */}
      {onToggleCollapse && (
        <>
          {/* person1 collapse button — centered above left card (card spans 0–160px, center = 80px) */}
          <button
            className="nodrag nopan absolute -top-7 z-10 flex items-center justify-center w-5 h-5 rounded-full bg-white border border-gray-300 shadow-sm hover:bg-gray-50 hover:border-amber-400 transition-colors"
            style={{ left: 70 }}
            onClick={(e) => { e.stopPropagation(); onToggleCollapse(person1._id); }}
            title={isCollapsed1 ? "Show ancestors" : "Hide ancestors"}
          >
            {isCollapsed1
              ? <ChevronDown size={11} className="text-gray-500" />
              : <ChevronUp size={11} className="text-gray-500" />}
          </button>
          {/* person2 collapse button — centered above right card (card spans 220–380px, center = 300px) */}
          <button
            className="nodrag nopan absolute -top-7 z-10 flex items-center justify-center w-5 h-5 rounded-full bg-white border border-gray-300 shadow-sm hover:bg-gray-50 hover:border-amber-400 transition-colors"
            style={{ left: 290 }}
            onClick={(e) => { e.stopPropagation(); onToggleCollapse(person2._id); }}
            title={isCollapsed2 ? "Show ancestors" : "Hide ancestors"}
          >
            {isCollapsed2
              ? <ChevronDown size={11} className="text-gray-500" />
              : <ChevronUp size={11} className="text-gray-500" />}
          </button>
        </>
      )}
      {/* Collapsed ancestor indicators */}
      {isCollapsed1 && (
        <div
          className="absolute -top-4 z-10 text-gray-300 text-[8px] tracking-[0.3em] select-none pointer-events-none"
          style={{ left: 57 }}
        >
          •••
        </div>
      )}
      {isCollapsed2 && (
        <div
          className="absolute -top-4 z-10 text-gray-300 text-[8px] tracking-[0.3em] select-none pointer-events-none"
          style={{ left: 277 }}
        >
          •••
        </div>
      )}

      <div className="flex items-center">
        <PersonCard
          person={person1}
          selected={selected}
          onClick={() => onSelect?.(person1)}
        />
        <MarriageLine isDivorced={isDivorced} divorceDate={divorceDate} />
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
              onClick={(e) => { e.stopPropagation(); onAddRelative(person1._id, role, person2._id); }}
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
