"use client";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  type Node,
  type Edge,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { PersonNode, type PersonNodeType } from "./PersonNode";
import type { TreeNode, TreeEdge } from "@/types";

const nodeTypes = { personNode: PersonNode };

interface Props {
  nodes: TreeNode[];
  edges: TreeEdge[];
  onNodeClick?: (personId: string) => void;
}

export function FamilyTree({
  nodes: initialNodes,
  edges: initialEdges,
  onNodeClick,
}: Props) {
  const [nodes, , onNodesChange] = useNodesState<PersonNodeType>(
    initialNodes as PersonNodeType[]
  );
  const [edges, , onEdgesChange] = useEdgesState(initialEdges as Edge[]);

  return (
    <div className="w-full h-full min-h-[600px] rounded-xl border bg-amber-50/30">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
        onNodeClick={(_, node) => onNodeClick?.(node.id)}
        fitView
      >
        <Background color="#f59e0b" gap={20} size={1} />
        <Controls />
        <MiniMap nodeColor="#f59e0b" />
      </ReactFlow>
    </div>
  );
}
