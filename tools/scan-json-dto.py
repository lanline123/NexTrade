#!/usr/bin/env python3
"""扫描 Admin Json 入参 DTO 的常见 422 风险。

1. handler 直接使用 `Json<实体>`（驼峰表单无法反序列化）
2. camelCase DTO 缺少 `#[serde(default)]`（可选字段缺失时 422）
3. DTO 没有 `rename_all = "camelCase"` 且字段为蛇形（前端驼峰提交会 422）

用法：
    python tools/scan-json-dto.py
"""
from __future__ import annotations

import pathlib
import re

ROOT = pathlib.Path(__file__).resolve().parents[1] / "rust" / "crates"
ROUTES = ROOT / "api/admin/src/routes"


def main() -> None:
    json_types: set[str] = set()
    for path in ROUTES.rglob("*.rs"):
        text = path.read_text(encoding="utf-8", errors="replace")
        json_types.update(re.findall(r"Json<([A-Za-z0-9_]+)>", text))

    entity_json: list[tuple[str, str]] = []
    defs: dict[str, tuple[str, str]] = {}
    struct_re = re.compile(r"((?:#\[[^\]]*\]\s*)*)pub struct ([A-Za-z0-9_]+)\b")
    for path in ROOT.rglob("*.rs"):
        if "target" in path.parts:
            continue
        text = path.read_text(encoding="utf-8", errors="replace")
        for match in struct_re.finditer(text):
            name = match.group(2)
            if name in json_types and name not in defs:
                defs[name] = (str(path.relative_to(ROOT)), match.group(1))
        for match in re.finditer(r"Json<([A-Za-z0-9_]+)>", text):
            name = match.group(1)
            if re.search(r"pub struct " + re.escape(name) + r"\b", text) and "entity" in str(path):
                entity_json.append((str(path.relative_to(ROOT)), name))

    no_rename = [(name, path) for name, (path, attrs) in defs.items() if "rename_all" not in attrs]
    no_default = [
        (name, path)
        for name, (path, attrs) in defs.items()
        if "rename_all" in attrs and "default" not in attrs
    ]

    print(f"Json 类型: {len(json_types)}，已定义: {len(defs)}")
    print(f"\n[高] Json<实体> 直接入参: {len(entity_json)}")
    for path, name in sorted(entity_json):
        print(f"  {name}  {path}")
    print(f"\n[中] DTO 缺少 rename_all: {len(no_rename)}")
    for name, path in sorted(no_rename):
        print(f"  {name}  {path}")
    print(f"\n[低] camelCase DTO 缺少 serde(default): {len(no_default)}")
    for name, path in sorted(no_default):
        print(f"  {name}  {path}")


if __name__ == "__main__":
    main()
