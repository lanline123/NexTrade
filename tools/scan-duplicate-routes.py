#!/usr/bin/env python3
"""扫描 Admin 路由中的重复 (method, path)。

Axum 0.8 对同一 Router 内重复路由会在启动时 panic：
`Overlapping method route`。该脚本做全局近似扫描，命中后需确认
两个路由是否真的被 merge 到同一个 Router（不同子 Router 允许同名路径）。

用法：
    python tools/scan-duplicate-routes.py
"""
from __future__ import annotations

import collections
import pathlib
import re

ROOT = pathlib.Path(__file__).resolve().parents[1]
ROUTES = ROOT / "rust" / "crates" / "api" / "admin" / "src" / "routes"

ROUTE_RE = re.compile(r'\.route\("([^"]+)",\s*(get|post|put|delete)\(')


def main() -> None:
    hits: dict[tuple[str, str], list[str]] = collections.defaultdict(list)
    for path in ROUTES.rglob("*.rs"):
        text = path.read_text(encoding="utf-8", errors="replace")
        for match in ROUTE_RE.finditer(text):
            hits[(match.group(2), match.group(1))].append(str(path.relative_to(ROOT)))

    dup = {key: files for key, files in hits.items() if len(files) > 1}
    print(f"路由总数: {sum(len(v) for v in hits.values())}，重复 (method, path): {len(dup)}")
    for (method, route), files in sorted(dup.items()):
        print(f"\n{method.upper()} {route}")
        for file in files:
            print(f"  {file}")


if __name__ == "__main__":
    main()
