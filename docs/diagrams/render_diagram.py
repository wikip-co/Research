#!/usr/bin/env python3

"""Render the Research workspace's build-fetch architecture diagrams."""

from __future__ import annotations

import base64
import html
from pathlib import Path
from textwrap import dedent

import yaml


ROOT = Path(__file__).resolve().parent
ASSETS = ROOT / "assets"
SPECS = ROOT / "specs"
RENDERED = ROOT / "rendered"

NODE_WIDTH = 220
NODE_HEIGHT = 126
NODE_RADIUS = 22
ICON_BG = "#ffffff"
CLUSTER_TITLE_OFFSET = 26
TEXT_COLOR = "#1f2937"
SUBTLE = "#64748b"


def data_uri(path: Path) -> str:
    encoded = base64.b64encode(path.read_bytes()).decode("ascii")
    return f"data:image/svg+xml;base64,{encoded}"


def esc(text: str) -> str:
    return html.escape(text, quote=True)


def split_lines(text: str) -> list[str]:
    return text.split("\\n")


def render_cluster(cluster: dict) -> str:
    x = cluster["x"]
    y = cluster["y"]
    width = cluster["width"]
    height = cluster["height"]
    bgcolor = cluster["graph_attr"]["bgcolor"]
    border = cluster["graph_attr"]["color"]
    label = esc(cluster["label"])
    return dedent(
        f"""
        <g class="cluster">
          <rect x="{x}" y="{y}" width="{width}" height="{height}" rx="28" fill="{bgcolor}" stroke="{border}" stroke-width="2"/>
          <text x="{x + 24}" y="{y + CLUSTER_TITLE_OFFSET}" font-size="24" font-weight="700" fill="{border}">{label}</text>
        </g>
        """
    ).strip()


def render_node(node: dict, href: str) -> str:
    x = node["x"]
    y = node["y"]
    color = node["attrs"]["color"]
    lines = split_lines(node["label"])
    text_y = y + 92
    tspan = []
    for index, line in enumerate(lines):
        dy = "0" if index == 0 else "22"
        tspan.append(f'<tspan x="{x + NODE_WIDTH / 2}" dy="{dy}">{esc(line)}</tspan>')
    tspans = "".join(tspan)
    return dedent(
        f"""
        <g class="node" id="{esc(node['id'])}">
          <rect x="{x}" y="{y}" width="{NODE_WIDTH}" height="{NODE_HEIGHT}" rx="{NODE_RADIUS}" fill="#ffffff" stroke="{color}" stroke-width="3"/>
          <circle cx="{x + NODE_WIDTH / 2}" cy="{y + 36}" r="24" fill="{ICON_BG}" stroke="{color}" stroke-width="2"/>
          <image href="{href}" x="{x + NODE_WIDTH / 2 - 16}" y="{y + 20}" width="32" height="32"/>
          <text x="{x + NODE_WIDTH / 2}" y="{text_y}" text-anchor="middle" font-size="18" font-weight="600" fill="{TEXT_COLOR}">{tspans}</text>
        </g>
        """
    ).strip()


def node_center(node: dict) -> tuple[float, float]:
    return node["x"] + NODE_WIDTH / 2, node["y"] + NODE_HEIGHT / 2


def edge_points(nodes: dict[str, dict], edge: dict) -> tuple[tuple[float, float], tuple[float, float], list[tuple[float, float]]]:
    src = nodes[edge["from"]]
    dst = nodes[edge["to"]]
    sx, sy = node_center(src)
    dx, dy = node_center(dst)

    if dx >= sx:
        start = (src["x"] + NODE_WIDTH, sy)
        end = (dst["x"], dy)
    else:
        start = (src["x"], sy)
        end = (dst["x"] + NODE_WIDTH, dy)

    mid_x = (start[0] + end[0]) / 2
    points = [start, (mid_x, start[1]), (mid_x, end[1]), end]
    return start, end, points


def polyline(points: list[tuple[float, float]]) -> str:
    return " ".join(f"{x},{y}" for x, y in points)


def render_edge(nodes: dict[str, dict], edge: dict) -> str:
    _, _, points = edge_points(nodes, edge)
    color = edge.get("color", "#64748b")
    width = edge.get("penwidth", "1.6")
    dash = ' stroke-dasharray="8 8"' if edge.get("style") == "dashed" else ""
    label = edge.get("label", "")
    label_lines = split_lines(label)
    label_x = edge.get("label_x", points[1][0])
    label_y = edge.get("label_y", (points[1][1] + points[2][1]) / 2 - (10 * (len(label_lines) - 1)))
    text = []
    for index, line in enumerate(label_lines):
        dy = "0" if index == 0 else "18"
        text.append(f'<tspan x="{label_x}" dy="{dy}">{esc(line)}</tspan>')
    label_svg = ""
    if label:
        max_line = max(len(line) for line in label_lines)
        box_width = max(140, min(320, 12 * max_line + 36))
        box_height = 34 + 18 * (len(label_lines) - 1)
        label_svg = (
            f'<rect x="{label_x - box_width / 2}" y="{label_y - 20}" width="{box_width}" height="{box_height}" '
            'rx="12" fill="#ffffff" fill-opacity="0.92"/>'
            f'<text x="{label_x}" y="{label_y}" text-anchor="middle" font-size="15" font-weight="600" fill="{SUBTLE}">{"".join(text)}</text>'
        )
    return dedent(
        f"""
        <g class="edge">
          <polyline points="{polyline(points)}" fill="none" stroke="{color}" stroke-width="{width}" stroke-linecap="round" stroke-linejoin="round"{dash} marker-end="url(#arrowhead)"/>
          {label_svg}
        </g>
        """
    ).strip()


def render(spec_path: Path) -> Path:
    spec = yaml.safe_load(spec_path.read_text())
    width = spec["canvas"]["width"]
    height = spec["canvas"]["height"]
    icon_map = {
        "onprem.github": data_uri(ASSETS / "github.svg"),
        "onprem.githubactions": data_uri(ASSETS / "githubactions.svg"),
    }
    nodes = {node["id"]: node for node in spec["nodes"]}

    svg_parts = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        f'<svg xmlns="http://www.w3.org/2000/svg" width="{width}" height="{height}" viewBox="0 0 {width} {height}">',
        "<defs>",
        '<marker id="arrowhead" markerWidth="10" markerHeight="10" refX="8" refY="5" orient="auto">'
        '<path d="M 0 0 L 10 5 L 0 10 z" fill="#475569"/>'
        "</marker>",
        "</defs>",
        f'<rect width="{width}" height="{height}" fill="#ffffff"/>',
        f'<text x="{width / 2}" y="38" text-anchor="middle" font-size="30" font-weight="700" fill="{TEXT_COLOR}">{esc(spec["title"])}</text>',
    ]

    for cluster in spec["clusters"]:
        svg_parts.append(render_cluster(cluster))

    for edge in spec["edges"]:
        svg_parts.append(render_edge(nodes, edge))

    for node in spec["nodes"]:
        svg_parts.append(render_node(node, icon_map[node["icon"]]))

    svg_parts.append("</svg>")
    output = RENDERED / f"{spec_path.stem}.svg"
    output.write_text("\n".join(svg_parts))
    return output


def main() -> None:
    for spec_path in sorted(SPECS.glob("*.yaml")):
        print(f"Rendering {spec_path.name}")
        render(spec_path)


if __name__ == "__main__":
    main()
