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

const genderAvatar: Record<string, string> = {
  male:    "bg-blue-50 text-blue-700",
  female:  "bg-pink-50 text-pink-700",
  other:   "bg-purple-50 text-purple-700",
  unknown: "bg-gray-50 text-gray-600",
};

function PersonHalf({
  person,
  onClick,
}: {
  person: IPerson;
  onClick: () => void;
}) {
  const initials = `${person.firstName[0] ?? "?"}${person.lastName[0] ?? ""}`;
  const gender = person.gender ?? "unknown";

  return (
    <div
      className="flex flex-col items-center px-3 py-2.5 cursor-pointer hover:bg-gray-50 transition-colors relative w-[88px]"
      onClick={(e) => { e.stopPropagation(); onClick(); }}
    >
      {/* Living dot */}
      <div className="relative mb-1.5">
        <Avatar className="h-10 w-10">
          <AvatarImage src={person.photoUrl} />
          <AvatarFallback className={`text-xs font-semibold ${genderAvatar[gender]}`}>
            {initials}
          </AvatarFallback>
        </Avatar>
        <span
          className={`absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-white ${
            person.isLiving ? "bg-green-400" : "bg-gray-400"
          }`}
        />
      </div>
      <p className="font-semibold text-[11px] leading-tight text-center truncate w-full">{person.firstName}</p>
      <p className="text-[10px] text-gray-500 leading-tight text-center truncate w-full">{person.lastName}</p>
      {person.birthDate && (
        <p className="text-[9px] text-gray-400 mt-0.5 truncate w-full text-center">{person.birthDate}</p>
      )}
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
      <Handle type="target" position={Position.Top} className="!bg-gray-300 !w-2 !h-2" />

      {/* Add parent buttons when selected */}
      {selected && onAddRelative && (
        <>
          <button
            className="nodrag nopan absolute -top-9 left-2 z-10 flex items-center gap-1 bg-white border border-gray-200 rounded-lg shadow px-2 py-1 text-[11px] font-medium text-gray-600 hover:border-amber-400 hover:text-amber-700 whitespace-nowrap"
            onClick={(e) => { e.stopPropagation(); onAddRelative(person1._id, "father"); }}
          >
            <span className="text-amber-500 font-bold">+</span> Add father
          </button>
          <button
            className="nodrag nopan absolute -top-9 right-2 z-10 flex items-center gap-1 bg-white border border-gray-200 rounded-lg shadow px-2 py-1 text-[11px] font-medium text-gray-600 hover:border-amber-400 hover:text-amber-700 whitespace-nowrap"
            onClick={(e) => { e.stopPropagation(); onAddRelative(person1._id, "mother"); }}
          >
            <span className="text-amber-500 font-bold">+</span> Add mother
          </button>
        </>
      )}

      {/* Couple card */}
      <div
        className={`bg-white border-2 rounded-xl shadow-sm overflow-hidden transition-all ${
          selected ? "border-amber-500 shadow-md shadow-amber-100" : "border-gray-200 hover:border-amber-300"
        }`}
      >
        {/* Top colored bar — split by gender */}
        <div className="flex h-1">
          <div className={`flex-1 ${person1.gender === "male" ? "bg-blue-300" : person1.gender === "female" ? "bg-pink-300" : "bg-gray-300"}`} />
          <div className={`flex-1 ${person2.gender === "male" ? "bg-blue-300" : person2.gender === "female" ? "bg-pink-300" : "bg-gray-300"}`} />
        </div>

        <div className="flex divide-x divide-gray-100">
          <PersonHalf person={person1} onClick={() => onSelect?.(person1)} />
          <PersonHalf person={person2} onClick={() => onSelect?.(person2)} />
        </div>
      </div>

      {/* Add child buttons */}
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
