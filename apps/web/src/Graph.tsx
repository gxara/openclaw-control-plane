import { useEffect, useRef } from "react";
import cytoscape, { type Core } from "cytoscape";

const STATUS_COLORS: Record<string, string> = {
  idle: "#71717a",
  thinking: "#3b82f6",
  working: "#eab308",
  error: "#ef4444",
};

interface GraphNode {
  id: string;
  label: string;
  status: string;
  last_message: string;
}

interface GraphProps {
  nodes: GraphNode[];
  edges: Array<{ source: string; target: string }>;
  onNodeSelect: (node: GraphNode) => void;
}

export function Graph({ nodes, edges, onNodeSelect }: GraphProps) {

  console.log("Graph", nodes, edges);
  const containerRef = useRef<HTMLDivElement>(null);
  const cyRef = useRef<Core | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const cy = cytoscape({
      container: containerRef.current,
      elements: [],
      style: [
        {
          selector: "node",
          style: {
            label: "data(label)",
            "background-color": "data(color)",
            color: "#0f0f12",
            "text-valign": "center",
            "text-halign": "center",
            width: 80,
            height: 40,
            "font-size": 11,
          },
        },
        {
          selector: "edge",
          style: {
            "curve-style": "bezier",
            "target-arrow-color": "#52525b",
            "target-arrow-shape": "triangle",
            "line-color": "#52525b",
          },
        },
      ],
      layout: { name: "grid" },
    });

    cy.on("tap", "node", (ev) => {
      const node = ev.target;
      const data = node.data();
      onNodeSelect({
        id: data.id,
        label: data.label,
        status: data.status,
        last_message: data.last_message,
      });
    });

    cyRef.current = cy;
    return () => {
      cy.destroy();
      cyRef.current = null;
    };
  }, [onNodeSelect]);

  useEffect(() => {
    const cy = cyRef.current;
    if (!cy) return;

    const nodeIds = new Set(nodes.map((n) => n.id));
    cy.nodes().filter((n) => !nodeIds.has(n.id())).remove();

    nodes.forEach((n) => {
      const existing = cy.getElementById(n.id);
      const color = STATUS_COLORS[n.status] ?? STATUS_COLORS.idle;
      if (existing.length) {
        existing.data({ label: n.label, status: n.status, last_message: n.last_message, color });
      } else {
        cy.add({
          group: "nodes",
          data: {
            id: n.id,
            label: n.label,
            status: n.status,
            last_message: n.last_message,
            color,
          },
        });
      }
    });

    const edgeIds = new Set(edges.map((e) => `${e.source}-${e.target}`));
    cy.edges().forEach((el) => {
      const sid = el.data("source");
      const tid = el.data("target");
      if (!edgeIds.has(`${sid}-${tid}`)) el.remove();
    });

    edges.forEach((e) => {
      const id = `${e.source}-${e.target}`;
      if (cy.getElementById(id).length) return;
      cy.add({
        group: "edges",
        data: { id, source: e.source, target: e.target },
      });
    });

    cy.layout({ name: "grid" }).run();
  }, [nodes, edges]);

  return <div ref={containerRef} style={{ width: "100%", height: "100%" }} />;
}
