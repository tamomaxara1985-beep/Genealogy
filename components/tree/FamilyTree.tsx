"use client";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  type Edge,
  type ReactFlowInstance,
  BackgroundVariant,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useEffect, useMemo, useRef } from "react";
import { PersonNode, type PersonNodeType } from "./PersonNode";
import { CoupleNode, type CoupleNodeType } from "./CoupleNode";
import { PolyCoupleNode, type PolyCoupleNodeType } from "./PolyCoupleNode";
import { applyDagreLayout } from "@/lib/treeLayout";
import type { TreeEdge } from "@/types";
import type { LayoutHints } from "@/lib/buildTreeData";

const nodeTypes = {
  personNode: PersonNode,
  coupleNode: CoupleNode,
  polyCoupleNode: PolyCoupleNode,
};

type AnyNode = PersonNodeType | CoupleNodeType | PolyCoupleNodeType;

interface Props {
  nodes: AnyNode[];
  edges: TreeEdge[];
  layoutHints?: LayoutHints;
}

export function FamilyTree({ nodes: rawNodes, edges: rawEdges, layoutHints }: Props) {
  // Derive stable ID keys so useMemo deps are simple expressions
  const nodeIds = rawNodes.map((n) => n.id).join(",");
  const edgeIds = rawEdges.map((e) => e.id).join(",");
  const hintsKey =
    `${layoutHints?.rootCenterNodeId ?? ""}|` +
    `${[...(layoutHints?.rightAncestorNodeIds ?? [])].sort().join(",")}|` +
    `${[...(layoutHints?.leftAncestorNodeIds ?? [])].sort().join(",")}`;

  const layoutNodes = useMemo(
    () => applyDagreLayout(rawNodes, rawEdges, layoutHints),
    // Re-layout only when node/edge IDs or layout hints change
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [nodeIds, edgeIds, hintsKey]
  );

  const [nodes, setNodes, onNodesChange] = useNodesState(layoutNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(rawEdges as Edge[]);

  const rfInstance = useRef<ReactFlowInstance<AnyNode, Edge> | null>(null);
  const isFirstLayout = useRef(true);

  // Sync layout; re-fit viewport when node set changes (e.g. second spouse added)
  useEffect(() => {
    setNodes(layoutNodes);
    if (!isFirstLayout.current) {
      const t = setTimeout(() => rfInstance.current?.fitView({ padding: 0.25, duration: 300 }), 50);
      return () => clearTimeout(t);
    }
    isFirstLayout.current = false;
  }, [layoutNodes, setNodes]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { setEdges(rawEdges as Edge[]); }, [edgeIds]);

  return (
    <div className="w-full flex-1 min-h-[600px] rounded-xl border bg-slate-50">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
        onInit={(instance) => { rfInstance.current = instance; }}
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
