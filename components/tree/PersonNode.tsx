"use client";
import { Handle, Position, type Node, type NodeProps } from "@xyflow/react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import type { IPerson, RelativeRole } from "@/types";

export type PersonNodeType = Node<
  {
    person: IPerson;
    onAddRelative?: (personId: string, role: RelativeRole) => void;
    onSelect?: (person: IPerson) => void;
  },
  "personNode"
>;

const ADD_BUTTONS: { role: RelativeRole; label: string; pos: string }[] = [
  { role: "father",   label: "Add father",   pos: "top-left" },
  { role: "mother",   label: "Add mother",   pos: "top-right" },
  { role: "brother",  label: "Add brother",  pos: "left-top" },
  { role: "sister",   label: "Add sister",   pos: "left-bottom" },
  { role: "spouse",   label: "Add spouse",   pos: "right" },
  { role: "son",      label: "Add son",      pos: "bottom-left" },
  { role: "daughter", label: "Add daughter", pos: "bottom-right" },
];

const posClass: Record<string, string> = {
  "top-left":    "absolute -top-10 left-0",
  "top-right":   "absolute -top-10 right-0",
  "left-top":    "absolute -left-32 top-0",
  "left-bottom": "absolute -left-32 bottom-0",
  "right":       "absolute -right-32 top-1/2 -translate-y-1/2",
  "bottom-left": "absolute -bottom-10 left-0",
  "bottom-right":"absolute -bottom-10 right-0",
};

const genderBorder: Record<string, string> = {
  male:    "border-blue-300",
  female:  "border-pink-300",
  other:   "border-purple-300",
  unknown: "border-amber-200",
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

export function PersonNode({ data, selected }: NodeProps<PersonNodeType>) {
  const { person, onAddRelative, onSelect } = data;
  const initials = `${person.firstName[0] ?? "?"}${person.lastName[0] ?? ""}`;
  const gender = person.gender ?? "unknown";
  const isLiving = person.isLiving;

  return (
    <div className="relative">
      <Handle type="target" position={Position.Top} className="!bg-gray-300 !w-2 !h-2" />

      {/* Contextual add buttons */}
      {selected && onAddRelative &&
        ADD_BUTTONS.map(({ role, label, pos }) => (
          <button
            key={role}
            className={`${posClass[pos]} nodrag nopan z-10 flex items-center gap-1.5 bg-white border border-gray-200 rounded-lg shadow-md px-2 py-1.5 text-xs font-medium text-gray-600 hover:border-amber-400 hover:text-amber-700 whitespace-nowrap transition-colors`}
            onClick={(e) => { e.stopPropagation(); onAddRelative(person._id, role); }}
          >
            <span className="h-4 w-4 rounded-full bg-amber-50 border border-amber-300 flex items-center justify-center text-amber-600 font-bold text-[9px]">+</span>
            {label}
          </button>
        ))}

      {/* Card */}
      <div
        className={`bg-white border-2 rounded-xl shadow-sm w-40 transition-all cursor-pointer select-none ${
          selected
            ? `${genderSelectedBorder[gender]} shadow-md`
            : `${genderBorder[gender]} hover:shadow-md`
        }`}
        onClick={() => onSelect?.(person)}
      >
        {/* Living indicator bar */}
        <div className={`h-1 rounded-t-xl ${isLiving ? "bg-green-400" : "bg-gray-300"}`} />

        <div className="px-3 py-2.5 flex items-center gap-2.5">
          <div className="relative flex-shrink-0">
            <Avatar className="h-11 w-11">
              <AvatarImage src={person.photoUrl} />
              <AvatarFallback className={`text-sm font-semibold ${genderAvatar[gender]}`}>
                {initials}
              </AvatarFallback>
            </Avatar>
            {/* Living dot */}
            <span className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-white ${isLiving ? "bg-green-400" : "bg-gray-400"}`} />
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

      <Handle type="source" position={Position.Bottom} className="!bg-gray-300 !w-2 !h-2" />
    </div>
  );
}
