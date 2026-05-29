"use client";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  type Edge,
  BackgroundVariant,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useMemo } from "react";
import { PersonNode, type PersonNodeType } from "./PersonNode";
import { CoupleNode, type CoupleNodeType } from "./CoupleNode";
import { applyDagreLayout } from "@/lib/treeLayout";
import type { TreeEdge } from "@/types";

const nodeTypes = {
  personNode: PersonNode,
  coupleNode: CoupleNode,
};

type AnyNode = PersonNodeType | CoupleNodeType;

interface Props {
  nodes: AnyNode[];
  edges: TreeEdge[];
}

export function FamilyTree({ nodes: rawNodes, edges: rawEdges }: Props) {
  const layoutNodes = useMemo(
    () => applyDagreLayout(rawNodes, rawEdges),
    // Re-layout only when node/edge IDs change
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rawNodes.map((n) => n.id).join(","), rawEdges.map((e) => e.id).join(",")]
  );

  const [nodes, , onNodesChange] = useNodesState(layoutNodes);
  const [edges, , onEdgesChange] = useEdgesState(rawEdges as Edge[]);

  return (
    <div className="w-full flex-1 min-h-[600px] rounded-xl border bg-slate-50">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.25 }}
        minZoom={0.1}
        maxZoom={2}
        proOptions={{ hideAttribution: true }}
      >
        <Background variant={BackgroundVariant.Dots} color="#cbd5e1" gap={20} size={1} />
        <Controls />
        <MiniMap
          nodeColor={(n) => {
            if (n.type === "coupleNode") return "#fde68a";
            const g = (n.data as { person?: { gender?: string } })?.person?.gender;
            if (g === "male") return "#bfdbfe";
            if (g === "female") return "#fbcfe8";
            return "#fde68a";
          }}
          maskColor="rgba(248,250,252,0.7)"
        />
      </ReactFlow>
    </div>
  );
}
