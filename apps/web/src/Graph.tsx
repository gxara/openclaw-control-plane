import { useEffect, useRef } from "react";
import cytoscape, { type Core } from "cytoscape";
// @ts-expect-error no types
import nodeHtmlLabel from "cytoscape-node-html-label";
// @ts-expect-error no types
import dagre from "cytoscape-dagre";

cytoscape.use(nodeHtmlLabel);
cytoscape.use(dagre);

const STATUS_COLORS: Record<string, string> = {
  idle: "#71717a",
  thinking: "#3b82f6",
  working: "#eab308",
  error: "#ef4444",
};

function formatHeartbeat(ts?: string): string {
  if (!ts) return "—";
  try {
    const d = new Date(ts);
    const now = new Date();
    const sec = Math.floor((now.getTime() - d.getTime()) / 1000);
    if (sec < 60) return `${sec}s ago`;
    if (sec < 3600) return `${Math.floor(sec / 60)}m ago`;
    return d.toLocaleTimeString();
  } catch {
    return "—";
  }
}

interface GraphNode {
  id: string;
  label: string;
  status: string;
  last_message: string;
  last_heartbeat?: string;
  parent?: string;
  nodeType?: "agent" | "session";
  runId?: string;
  lastChannel?: string;
}

function channelIcon(lastChannel?: string): string {
  if (!lastChannel) return "";
  const ch = lastChannel.toLowerCase();
  if (ch === "discord") return '<img src="/icons/discord.svg" alt="Discord" class="cy-card__channel-icon" />';
  if (ch === "webchat" || ch === "web") return '<img src="/icons/web.svg" alt="Web" class="cy-card__channel-icon" />';
  return "";
}

interface GraphProps {
  nodes: GraphNode[];
  edges: Array<{ source: string; target: string }>;
  onNodeSelect: (node: GraphNode) => void;
}

export function Graph({ nodes, edges, onNodeSelect }: GraphProps) {
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
            "background-color": "transparent",
            "border-width": 0,
            width: 140,
            height: 72,
          },
        },
        {
          selector: "node[nodeType='session']",
          style: { width: 110, height: 48 },
        },
        {
          selector: "edge",
          style: {
            "curve-style": "bezier",
            "target-arrow-color": "#52525b",
            "target-arrow-shape": "triangle",
            "line-color": "#3f3f46",
            "width": 1,
          },
        },
      ],
      layout: { name: "dagre", rankDir: "TB" } as cytoscape.LayoutOptions,
    });

    cy.on("tap", "node", (ev) => {
      const node = ev.target;
      const data = node.data();
      onNodeSelect({
        id: data.id,
        label: data.label,
        status: data.status,
        last_message: data.last_message,
        last_heartbeat: data.last_heartbeat,
        nodeType: data.nodeType,
        runId: data.runId,
        lastChannel: data.lastChannel,
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
      const data: Record<string, unknown> = {
        label: n.label,
        status: n.status,
        last_message: n.last_message,
        last_heartbeat: n.last_heartbeat,
        color,
        nodeType: n.nodeType,
        runId: n.runId,
        lastChannel: n.lastChannel,
      };
      if (existing.length) {
        existing.data(data);
      } else {
        cy.add({
          group: "nodes",
          data: { id: n.id, ...data },
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

    (cy as Core & { nodeHtmlLabel: (opts: unknown, extra?: unknown) => void })
      .nodeHtmlLabel([
        {
          query: "node[nodeType='agent']",
          halign: "center",
          valign: "center",
          halignBox: "center",
          valignBox: "center",
          cssClass: "cy-node-card",
          tpl(data: Record<string, unknown>) {
            const label = String(data.label ?? "Agent");
            const message = String(data.last_message ?? "—");
            const heartbeat = formatHeartbeat(data.last_heartbeat as string);
            const color = (data.color as string) ?? STATUS_COLORS.idle;
            return `
              <div class="cy-card cy-card--agent" style="border-left-color: ${color}">
                <div class="cy-card__name">${escapeHtml(label)}</div>
                <div class="cy-card__task" title="${escapeHtml(message)}">${escapeHtml(truncate(message, 35))}</div>
                <div class="cy-card__heartbeat">${escapeHtml(heartbeat)}</div>
              </div>
            `;
          },
        },
        {
          query: "node[nodeType='session']",
          halign: "center",
          valign: "center",
          halignBox: "center",
          valignBox: "center",
          cssClass: "cy-node-card",
          tpl(data: Record<string, unknown>) {
            const label = String(data.label ?? "—");
            const message = String(data.last_message ?? "—");
            const heartbeat = formatHeartbeat(data.last_heartbeat as string);
            const color = (data.color as string) ?? STATUS_COLORS.idle;
            const channel = channelIcon(data.lastChannel as string);
            return `
              <div class="cy-card cy-card--session" style="border-left-color: ${color}">
                <div class="cy-card__header">
                  ${channel}
                  <div class="cy-card__name">${escapeHtml(label)}</div>
                </div>
                <div class="cy-card__task" title="${escapeHtml(message)}">${escapeHtml(truncate(message, 25))}</div>
                <div class="cy-card__heartbeat">${escapeHtml(heartbeat)}</div>
              </div>
            `;
          },
        },
      ], { enablePointerEvents: true });

    cy.layout({
      name: "dagre",
      rankDir: "TB",
      nodeSep: 140,
      rankSep: 90,
    } as cytoscape.LayoutOptions).run();
  }, [nodes, edges]);

  return <div ref={containerRef} style={{ width: "100%", height: "100%" }} />;
}

function escapeHtml(s: string): string {
  const div = document.createElement("div");
  div.textContent = s;
  return div.innerHTML;
}

function truncate(s: string, len: number): string {
  if (s.length <= len) return s;
  return s.slice(0, len) + "…";
}
