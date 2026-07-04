"use client";
import { Handle, Position, type Node, type NodeProps } from "@xyflow/react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Plus, Minus } from "lucide-react";
import type { IPerson, RelativeRole } from "@/types";

// Layout (width = 600px):
//  leftSpouse [0-160]  line [160-220]  shared [220-380]  line [380-440]  rightSpouse [440-600]
// Source handles: "left" at x=190, "right" at x=410

export type PolyCoupleNodeType = Node<
  {
    leftSpouse: IPerson;
    shared: IPerson;
    rightSpouse: IPerson;
    isDivorced1?: boolean;
    divorceDate1?: string;
    isDivorced2?: boolean;
    divorceDate2?: string;
    onAddRelative?: (personId: string, role: RelativeRole, personId2?: string) => void;
    onSelect?: (person: IPerson) => void;
    siblingInfo?: Record<string, { count: number; expanded: boolean }>;
    onToggleSiblings?: (personId: string) => void;
  },
  "polyCoupleNode"
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
  unknown: "border-emerald-500",
};
const genderAvatar: Record<string, string> = {
  male:    "bg-blue-50 text-blue-700",
  female:  "bg-pink-50 text-pink-700",
  other:   "bg-purple-50 text-purple-700",
  unknown: "bg-gray-50 text-gray-600",
};

function PersonCard({ person, selected, onClick }: { person: IPerson; selected: boolean; onClick: () => void }) {
  const initials = `${person.firstName[0] ?? "?"}${person.lastName[0] ?? ""}`;
  const gender = person.gender ?? "unknown";
  return (
    <div
      className={`bg-white border-2 rounded-xl shadow-sm w-40 cursor-pointer select-none transition-all ${
        selected ? `${genderSelectedBorder[gender]} shadow-md` : `${genderBorder[gender]} hover:shadow-md`
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
          <span className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-white ${person.isLiving ? "bg-green-400" : "bg-gray-400"}`} />
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
        {divorceDate && <span className="text-[9px] text-red-400 leading-none">{divorceDate}</span>}
      </div>
    );
  }
  return (
    <div className="flex items-center w-[60px] flex-shrink-0">
      <div className="flex-1 h-[1.5px] bg-emerald-400" />
      <span className="text-emerald-500 text-sm mx-1 leading-none select-none">♥</span>
      <div className="flex-1 h-[1.5px] bg-emerald-400" />
    </div>
  );
}

const CHILD_ROLES: { role: RelativeRole; label: string }[] = [
  { role: "son",      label: "Add son" },
  { role: "daughter", label: "Add daughter" },
];

export function PolyCoupleNode({ data, selected }: NodeProps<PolyCoupleNodeType>) {
  const { leftSpouse, shared, rightSpouse, isDivorced1, divorceDate1, isDivorced2, divorceDate2, onAddRelative, onSelect, siblingInfo, onToggleSiblings } = data;
  const sibL = siblingInfo?.[leftSpouse._id];
  const sibS = siblingInfo?.[shared._id];
  const sibR = siblingInfo?.[rightSpouse._id];

  return (
    <div className="relative">
      {/* one centered target handle above each card */}
      <Handle type="target" position={Position.Top} id="left"   style={{ left:  80 }} className="!bg-gray-300 !w-2 !h-2" />
      <Handle type="target" position={Position.Top} id="shared" style={{ left: 300 }} className="!bg-gray-300 !w-2 !h-2" />
      <Handle type="target" position={Position.Top} id="right"  style={{ left: 520 }} className="!bg-gray-300 !w-2 !h-2" />

      {/* Action buttons when selected */}
      {selected && onAddRelative && (
        <>
          {/* leftSpouse parents */}
          <button
            className="nodrag nopan absolute -top-16 left-0 z-10 flex items-center gap-1 bg-white border border-gray-200 rounded-lg shadow px-2 py-1 text-[11px] font-medium text-gray-600 hover:border-emerald-400 hover:text-emerald-700 whitespace-nowrap"
            onClick={(e) => { e.stopPropagation(); onAddRelative(leftSpouse._id, "father"); }}
          >
            <span className="text-emerald-500 font-bold">+</span> {leftSpouse.firstName}&apos;s father
          </button>
          <button
            className="nodrag nopan absolute -top-9 left-0 z-10 flex items-center gap-1 bg-white border border-gray-200 rounded-lg shadow px-2 py-1 text-[11px] font-medium text-gray-600 hover:border-emerald-400 hover:text-emerald-700 whitespace-nowrap"
            onClick={(e) => { e.stopPropagation(); onAddRelative(leftSpouse._id, "mother"); }}
          >
            <span className="text-emerald-500 font-bold">+</span> {leftSpouse.firstName}&apos;s mother
          </button>
          {/* shared parents */}
          <button
            className="nodrag nopan absolute -top-16 z-10 flex items-center gap-1 bg-white border border-gray-200 rounded-lg shadow px-2 py-1 text-[11px] font-medium text-gray-600 hover:border-emerald-400 hover:text-emerald-700 whitespace-nowrap"
            style={{ left: 220 }}
            onClick={(e) => { e.stopPropagation(); onAddRelative(shared._id, "father"); }}
          >
            <span className="text-emerald-500 font-bold">+</span> {shared.firstName}&apos;s father
          </button>
          <button
            className="nodrag nopan absolute -top-9 z-10 flex items-center gap-1 bg-white border border-gray-200 rounded-lg shadow px-2 py-1 text-[11px] font-medium text-gray-600 hover:border-emerald-400 hover:text-emerald-700 whitespace-nowrap"
            style={{ left: 220 }}
            onClick={(e) => { e.stopPropagation(); onAddRelative(shared._id, "mother"); }}
          >
            <span className="text-emerald-500 font-bold">+</span> {shared.firstName}&apos;s mother
          </button>
          {/* rightSpouse parents */}
          <button
            className="nodrag nopan absolute -top-16 right-0 z-10 flex items-center gap-1 bg-white border border-gray-200 rounded-lg shadow px-2 py-1 text-[11px] font-medium text-gray-600 hover:border-emerald-400 hover:text-emerald-700 whitespace-nowrap"
            onClick={(e) => { e.stopPropagation(); onAddRelative(rightSpouse._id, "father"); }}
          >
            <span className="text-emerald-500 font-bold">+</span> {rightSpouse.firstName}&apos;s father
          </button>
          <button
            className="nodrag nopan absolute -top-9 right-0 z-10 flex items-center gap-1 bg-white border border-gray-200 rounded-lg shadow px-2 py-1 text-[11px] font-medium text-gray-600 hover:border-emerald-400 hover:text-emerald-700 whitespace-nowrap"
            onClick={(e) => { e.stopPropagation(); onAddRelative(rightSpouse._id, "mother"); }}
          >
            <span className="text-emerald-500 font-bold">+</span> {rightSpouse.firstName}&apos;s mother
          </button>
        </>
      )}

      {/* Three person cards */}
      <div className="flex items-center">
        <PersonCard person={leftSpouse} selected={selected} onClick={() => onSelect?.(leftSpouse)} />
        <MarriageLine isDivorced={isDivorced1} divorceDate={divorceDate1} />
        <PersonCard person={shared} selected={selected} onClick={() => onSelect?.(shared)} />
        <MarriageLine isDivorced={isDivorced2} divorceDate={divorceDate2} />
        <PersonCard person={rightSpouse} selected={selected} onClick={() => onSelect?.(rightSpouse)} />
      </div>

      {/* Sibling reveal controls — left edge of each card */}
      {onToggleSiblings && sibL && sibL.count > 0 && (
        <button
          className="nodrag nopan absolute top-1/2 -translate-y-1/2 z-10 flex items-center justify-center w-6 h-6 rounded-full bg-white border border-gray-300 shadow-sm text-[11px] font-semibold text-gray-600 hover:bg-gray-50 hover:border-emerald-400 hover:text-emerald-700 transition-colors"
          style={{ left: -28 }}
          onClick={(e) => { e.stopPropagation(); onToggleSiblings(leftSpouse._id); }}
          title={sibL.expanded ? "Hide siblings" : `Show ${sibL.count} sibling${sibL.count === 1 ? "" : "s"}`}
        >
          {sibL.expanded ? <Minus size={12} /> : sibL.count}
        </button>
      )}
      {onToggleSiblings && sibS && sibS.count > 0 && (
        <button
          className="nodrag nopan absolute top-1/2 -translate-y-1/2 z-10 flex items-center justify-center w-6 h-6 rounded-full bg-white border border-gray-300 shadow-sm text-[11px] font-semibold text-gray-600 hover:bg-gray-50 hover:border-emerald-400 hover:text-emerald-700 transition-colors"
          style={{ left: 192 }}
          onClick={(e) => { e.stopPropagation(); onToggleSiblings(shared._id); }}
          title={sibS.expanded ? "Hide siblings" : `Show ${sibS.count} sibling${sibS.count === 1 ? "" : "s"}`}
        >
          {sibS.expanded ? <Minus size={12} /> : sibS.count}
        </button>
      )}
      {onToggleSiblings && sibR && sibR.count > 0 && (
        <button
          className="nodrag nopan absolute top-1/2 -translate-y-1/2 z-10 flex items-center justify-center w-6 h-6 rounded-full bg-white border border-gray-300 shadow-sm text-[11px] font-semibold text-gray-600 hover:bg-gray-50 hover:border-emerald-400 hover:text-emerald-700 transition-colors"
          style={{ left: 412 }}
          onClick={(e) => { e.stopPropagation(); onToggleSiblings(rightSpouse._id); }}
          title={sibR.expanded ? "Hide siblings" : `Show ${sibR.count} sibling${sibR.count === 1 ? "" : "s"}`}
        >
          {sibR.expanded ? <Minus size={12} /> : sibR.count}
        </button>
      )}

      {/* Child buttons for each marriage when selected */}
      {selected && onAddRelative && (
        <>
          <div className="absolute -bottom-9 left-0 flex gap-1 z-10">
            {CHILD_ROLES.map(({ role, label }) => (
              <button
                key={`left-${role}`}
                className="nodrag nopan flex items-center gap-1 bg-white border border-gray-200 rounded-lg shadow px-2 py-1 text-[11px] font-medium text-gray-600 hover:border-emerald-400 hover:text-emerald-700 whitespace-nowrap"
                onClick={(e) => { e.stopPropagation(); onAddRelative(leftSpouse._id, role, shared._id); }}
              >
                <span className="text-emerald-500 font-bold">+</span> {label}
              </button>
            ))}
          </div>
          <div className="absolute -bottom-9 right-0 flex gap-1 z-10">
            {CHILD_ROLES.map(({ role, label }) => (
              <button
                key={`right-${role}`}
                className="nodrag nopan flex items-center gap-1 bg-white border border-gray-200 rounded-lg shadow px-2 py-1 text-[11px] font-medium text-gray-600 hover:border-emerald-400 hover:text-emerald-700 whitespace-nowrap"
                onClick={(e) => { e.stopPropagation(); onAddRelative(shared._id, role, rightSpouse._id); }}
              >
                <span className="text-emerald-500 font-bold">+</span> {label}
              </button>
            ))}
          </div>
        </>
      )}

      {/* Source handles — one per marriage, centered over each pair */}
      <Handle type="source" id="left"  position={Position.Bottom} style={{ left: 190 }} className="!bg-gray-300 !w-2 !h-2" />
      <Handle type="source" id="right" position={Position.Bottom} style={{ left: 410 }} className="!bg-gray-300 !w-2 !h-2" />
    </div>
  );
}
