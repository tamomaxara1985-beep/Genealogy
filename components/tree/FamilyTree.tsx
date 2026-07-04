"use client";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  Panel,
  useNodesState,
  useEdgesState,
  type Edge,
  type ReactFlowInstance,
  BackgroundVariant,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { PersonNode, type PersonNodeType } from "./PersonNode";
import { CoupleNode, type CoupleNodeType } from "./CoupleNode";
import { PolyCoupleNode, type PolyCoupleNodeType } from "./PolyCoupleNode";
import { applyDagreLayout } from "@/lib/treeLayout";
import { nodesContentSignature, edgesSignature } from "@/lib/treeNodesSignature";
import { exportTreeToPdf, type PaperSize } from "@/lib/exportTree";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Printer, Loader2, ChevronDown } from "lucide-react";
import type { TreeEdge } from "@/types";

const nodeTypes = {
  personNode: PersonNode,
  coupleNode: CoupleNode,
  polyCoupleNode: PolyCoupleNode,
};

const PAPER_SIZES: PaperSize[] = ["A4", "A3", "A2", "A1"];

type AnyNode = PersonNodeType | CoupleNodeType | PolyCoupleNodeType;

interface Props {
  nodes: AnyNode[];
  edges: TreeEdge[];
  title?: string;
}

export function FamilyTree({ nodes: rawNodes, edges: rawEdges, title }: Props) {
  const t = useTranslations("tree");

  // Derive stable ID keys so useMemo deps are simple expressions
  const nodeIds = rawNodes.map((n) => n.id).join(",");
  // Edge signature keys on endpoints/handles, not just ids: an edge retargets
  // (person → couple node) without its id changing, and that must re-apply.
  const edgeSig = edgesSignature(rawEdges);
  const contentSig = nodesContentSignature(rawNodes);

  const layoutNodes = useMemo(
    () => applyDagreLayout(rawNodes, rawEdges),
    // Re-layout when the node set, edge structure/endpoints, or card content changes
    // (content edits keep identical dagre positions since layout is structural).
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [nodeIds, edgeSig, contentSig]
  );

  const [nodes, setNodes, onNodesChange] = useNodesState(layoutNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(rawEdges as Edge[]);

  const rfInstance = useRef<ReactFlowInstance<AnyNode, Edge> | null>(null);
  const isFirstLayout = useRef(true);
  const [printing, setPrinting] = useState(false);

  // Push fresh layout/data into the canvas on any change (structure OR content edit).
  useEffect(() => {
    setNodes(layoutNodes);
  }, [layoutNodes, setNodes]);

  // Re-fit the viewport only when the node SET changes (add/remove/expand),
  // NOT on content edits — editing a field must not move or re-center the view.
  useEffect(() => {
    if (isFirstLayout.current) {
      isFirstLayout.current = false;
      return;
    }
    const t = setTimeout(() => rfInstance.current?.fitView({ padding: 0.25, duration: 300 }), 50);
    return () => clearTimeout(t);
  }, [nodeIds]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { setEdges(rawEdges as Edge[]); }, [edgeSig]);

  async function handlePrint(paper: PaperSize) {
    setPrinting(true);
    try {
      await exportTreeToPdf({ nodes, paper, title });
    } catch {
      alert(t("printError"));
    } finally {
      setPrinting(false);
    }
  }

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
        <Panel position="top-right">
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  variant="outline"
                  size="sm"
                  disabled={printing || nodes.length === 0}
                  className="gap-1.5 bg-white"
                />
              }
            >
              {printing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Printer className="h-4 w-4" />
              )}
              {printing ? t("printing") : t("print")}
              <ChevronDown className="h-3.5 w-3.5 opacity-60" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {PAPER_SIZES.map((p) => (
                <DropdownMenuItem key={p} onClick={() => handlePrint(p)}>
                  {p}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </Panel>
        <Background variant={BackgroundVariant.Dots} color="#cbd5e1" gap={20} size={1} />
        <Controls />
        <MiniMap
          nodeColor={(n) => {
            if (n.type === "coupleNode") return "#a7f3d0";
            const g = (n.data as { person?: { gender?: string } })?.person?.gender;
            if (g === "male") return "#bfdbfe";
            if (g === "female") return "#fbcfe8";
            return "#a7f3d0";
          }}
          maskColor="rgba(248,250,252,0.7)"
        />
      </ReactFlow>
    </div>
  );
}
