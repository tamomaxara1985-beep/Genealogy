"use client";
import { Handle, Position, type Node, type NodeProps } from "@xyflow/react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import type { IPerson, RelativeRole } from "@/types";

export type MultiCoupleNodeType = Node<
  {
    shared: IPerson;
    marriages: { spouse: IPerson; isDivorced?: boolean; divorceDate?: string }[];
    width: number;
    onAddRelative?: (personId: string, role: RelativeRole, personId2?: string) => void;
    onSelect?: (person: IPerson) => void;
    siblingInfo?: Record<string, { count: number; expanded: boolean }>;
    onToggleSiblings?: (personId: string) => void;
  },
  "multiCoupleNode"
>;

const genderBorder: Record<string, string> = {
  male: "border-blue-300", female: "border-pink-300", other: "border-purple-300", unknown: "border-gray-200",
};
const genderSelectedBorder: Record<string, string> = {
  male: "border-blue-500", female: "border-pink-500", other: "border-purple-500", unknown: "border-emerald-500",
};
const genderAvatar: Record<string, string> = {
  male: "bg-blue-50 text-blue-700", female: "bg-pink-50 text-pink-700", other: "bg-purple-50 text-purple-700", unknown: "bg-gray-50 text-gray-600",
};

function PersonCard({ person, selected, onClick }: { person: IPerson; selected: boolean; onClick: () => void }) {
  const initials = `${person.firstName[0] ?? "?"}${person.lastName[0] ?? ""}`;
  const gender = person.gender ?? "unknown";
  return (
    <div
      className={`bg-white border-2 rounded-xl shadow-sm w-40 shrink-0 cursor-pointer select-none transition-all ${
        selected ? `${genderSelectedBorder[gender]} shadow-md` : `${genderBorder[gender]} hover:shadow-md`
      }`}
      onClick={(e) => { e.stopPropagation(); onClick(); }}
    >
      <div className={`h-1 rounded-t-xl ${person.isLiving ? "bg-green-400" : "bg-gray-300"}`} />
      <div className="px-3 py-2.5 flex items-center gap-2.5">
        <div className="relative flex-shrink-0">
          <Avatar className="h-11 w-11">
            <AvatarImage src={person.photoUrl} />
            <AvatarFallback className={`text-sm font-semibold ${genderAvatar[gender]}`}>{initials}</AvatarFallback>
          </Avatar>
          <span className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-white ${person.isLiving ? "bg-green-400" : "bg-gray-400"}`} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-xs leading-tight truncate">{person.firstName}</p>
          <p className="text-xs text-gray-600 leading-tight truncate">{person.lastName}</p>
          {(person.birthDate || person.deathDate) && (
            <p className="text-[10px] text-gray-400 leading-tight mt-0.5 truncate">
              {person.birthDate ?? "?"}{!person.isLiving && person.deathDate ? `–${person.deathDate}` : ""}
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
      <div className="flex flex-col items-center w-[60px] shrink-0 gap-0.5">
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
    <div className="flex items-center w-[60px] shrink-0">
      <div className="flex-1 h-[1.5px] bg-emerald-400" />
      <span className="text-emerald-500 text-sm mx-1 leading-none select-none">♥</span>
      <div className="flex-1 h-[1.5px] bg-emerald-400" />
    </div>
  );
}

export function MultiCoupleNode({ data, selected }: NodeProps<MultiCoupleNodeType>) {
  const { shared, marriages, onSelect } = data;
  return (
    <div className="relative">
      <Handle type="target" position={Position.Top} id="shared" style={{ left: 80 }} className="!bg-gray-300 !w-2 !h-2" />
      {marriages.map((_, k) => (
        <Handle key={`t${k}`} type="target" position={Position.Top} id={`spouse${k}`} style={{ left: 300 + 220 * k }} className="!bg-gray-300 !w-2 !h-2" />
      ))}

      <div className="flex items-center">
        <PersonCard person={shared} selected={selected} onClick={() => onSelect?.(shared)} />
        {marriages.map((m) => (
          <div key={m.spouse._id} className="flex items-center">
            <MarriageLine isDivorced={m.isDivorced} divorceDate={m.divorceDate} />
            <PersonCard person={m.spouse} selected={selected} onClick={() => onSelect?.(m.spouse)} />
          </div>
        ))}
      </div>

      {marriages.map((_, k) => (
        <Handle key={`s${k}`} type="source" position={Position.Bottom} id={`m${k}`} style={{ left: 300 + 220 * k }} className="!bg-gray-300 !w-2 !h-2" />
      ))}
    </div>
  );
}
