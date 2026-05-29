"use client";
import { Handle, Position, type Node, type NodeProps } from "@xyflow/react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import type { IPerson } from "@/types";

export type PersonNodeType = Node<{ person: IPerson }, "personNode">;

export function PersonNode({ data }: NodeProps<PersonNodeType>) {
  const { person } = data;
  const initials = `${person.firstName[0]}${person.lastName[0]}`;
  return (
    <div className="bg-white border-2 border-amber-200 rounded-xl p-3 shadow-sm min-w-36 text-center hover:border-amber-500 transition-colors">
      <Handle type="target" position={Position.Top} className="!bg-amber-400" />
      <Avatar className="h-12 w-12 mx-auto mb-2">
        <AvatarImage src={person.photoUrl} />
        <AvatarFallback>{initials}</AvatarFallback>
      </Avatar>
      <p className="font-semibold text-sm">{person.firstName}</p>
      <p className="text-sm text-gray-700">{person.lastName}</p>
      {person.birthDate && (
        <p className="text-xs text-gray-400">b. {person.birthDate}</p>
      )}
      <Handle
        type="source"
        position={Position.Bottom}
        className="!bg-amber-400"
      />
    </div>
  );
}
