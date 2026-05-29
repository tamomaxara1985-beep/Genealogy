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
  "top-left":     "absolute -top-10 left-0",
  "top-right":    "absolute -top-10 right-0",
  "left-top":     "absolute -left-32 top-0",
  "left-bottom":  "absolute -left-32 bottom-0",
  "right":        "absolute -right-32 top-1/2 -translate-y-1/2",
  "bottom-left":  "absolute -bottom-10 left-0",
  "bottom-right": "absolute -bottom-10 right-0",
};

export function PersonNode({ data, selected }: NodeProps<PersonNodeType>) {
  const { person, onAddRelative, onSelect } = data;
  const initials = `${person.firstName[0]}${person.lastName[0]}`;

  return (
    <div className="relative">
      <Handle type="target" position={Position.Top} className="!bg-amber-400" />

      {/* Contextual add buttons — only when selected */}
      {selected && onAddRelative &&
        ADD_BUTTONS.map(({ role, label, pos }) => (
          <button
            key={role}
            className={`${posClass[pos]} nodrag nopan z-10 flex items-center gap-1.5 bg-white border border-gray-200 rounded-lg shadow-md px-2 py-1.5 text-xs font-medium text-gray-700 hover:border-amber-400 hover:text-amber-700 whitespace-nowrap transition-colors`}
            onClick={(e) => {
              e.stopPropagation();
              onAddRelative(person._id, role);
            }}
          >
            <span className="h-5 w-5 rounded-full bg-gray-100 flex items-center justify-center text-gray-400 text-[10px]">
              +
            </span>
            {label}
          </button>
        ))}

      {/* Card */}
      <div
        className={`bg-white border-2 rounded-xl p-3 shadow-sm min-w-36 text-center transition-colors cursor-pointer ${
          selected ? "border-amber-500 shadow-amber-100 shadow-md" : "border-amber-200 hover:border-amber-400"
        }`}
        onClick={() => onSelect?.(person)}
      >
        <Avatar className="h-12 w-12 mx-auto mb-2">
          <AvatarImage src={person.photoUrl} />
          <AvatarFallback className={person.gender === "male" ? "bg-blue-50 text-blue-700" : person.gender === "female" ? "bg-pink-50 text-pink-700" : ""}>
            {initials}
          </AvatarFallback>
        </Avatar>
        <p className="font-semibold text-sm">{person.firstName}</p>
        <p className="text-sm text-gray-700">{person.lastName}</p>
        {person.birthDate && (
          <p className="text-xs text-gray-400">b. {person.birthDate}</p>
        )}
      </div>

      <Handle type="source" position={Position.Bottom} className="!bg-amber-400" />
    </div>
  );
}
