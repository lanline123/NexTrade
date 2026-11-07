# -*- coding: utf-8 -*-
"""从 Rust 源码提取全部后端路由，生成 docs/BACKEND-API.md。"""
import os
import re
from collections import defaultdict

REPO = r"D:\tigshop\NexTrade"
RUST = os.path.join(REPO, "rust", "crates")
OUT = os.path.join(REPO, "docs", "BACKEND-API.md")

string_route = re.compile(r'route\(\s*"([^"]+)"\s*,\s*(get|post|put|delete|patch)\(')
tuple_route = re.compile(r'\(\s*"(GET|POST|PUT|DELETE|PATCH)"\s*,\s*"([^"]+)"\s*,')
chained_get_post = re.compile(r'route\(\s*"([^"]+)"\s*,\s*get\([^)]*\)\.post\(')
chained_post_get = re.compile(r'route\(\s*"([^"]+)"\s*,\s*post\([^)]*\)\.get\(')


def full_path(module_prefix, literal):
    p = literal.strip()
    p = re.sub(r"//+", "/", p)
    if not p.startswith("/"):
        p = "/" + p
    # 字面量已带全局前缀的保持原样
    if p.startswith("/adminapi") or p.startswith("/api") or p.startswith("/static"):
        return p.rstrip("/")
    return (module_prefix + p).rstrip("/")


routes = {}  # (method, path) -> set(source files short names)
for crate_prefix, scan_root in (
    ("/adminapi", os.path.join(RUST, "api", "admin", "src")),
    ("/api", os.path.join(RUST, "api", "public", "src")),
):
    if not os.path.isdir(scan_root):
        continue
    for dirpath, _, files in os.walk(scan_root):
        for name in files:
            if not name.endswith(".rs"):
                continue
            fp = os.path.join(dirpath, name)
            try:
                text = open(fp, encoding="utf-8", errors="ignore").read()
            except Exception:
                continue
            src = os.path.relpath(fp, RUST).replace("\\", "/")
            found = set()
            for m in string_route.finditer(text):
                found.add((m.group(2).upper(), full_path(crate_prefix, m.group(1))))
            for m in tuple_route.finditer(text):
                # tuple 表是文档清单，可能带 /adminapi 前缀
                p = m.group(2)
                if p.startswith("/adminapi"):
                    found.add((m.group(1), p.rstrip("/")))
                else:
                    found.add((m.group(1), full_path(crate_prefix, p)))
            for m in chained_get_post.finditer(text):
                found.add(("GET", full_path(crate_prefix, m.group(1))))
                found.add(("POST", full_path(crate_prefix, m.group(1))))
            for m in chained_post_get.finditer(text):
                found.add(("POST", full_path(crate_prefix, m.group(1))))
                found.add(("GET", full_path(crate_prefix, m.group(1))))
            for key in found:
                routes.setdefault(key, set()).add(src)

admin = sorted((m, p) for (m, p) in routes if p.startswith("/adminapi"))
public = sorted((m, p) for (m, p) in routes if p.startswith("/api") and not p.startswith("/api/adminapi"))
other = sorted((m, p) for (m, p) in routes if not p.startswith("/adminapi") and not (p.startswith("/api") and not p.startswith("/api/adminapi")))


def group_table(items):
    groups = defaultdict(list)
    for m, p in items:
        parts = p.split("/")
        # /adminapi/order/order/list → 分组键取前两段业务前缀
        key = "/".join(parts[:4]) if len(parts) > 3 else "/".join(parts[:3])
        groups[key].append((m, p))
    out = []
    for key in sorted(groups):
        out.append(f"### {key}\n")
        out.append("| 方法 | 路径 |")
        out.append("|------|------|")
        for m, p in sorted(groups[key]):
            out.append(f"| {m} | `{p}` |")
        out.append("")
    return "\n".join(out)


lines = []
lines.append("# 后端接口清单（BACKEND-API）")
lines.append("")
lines.append("> 本文档由脚本从 Rust 源码自动提取生成（扫描 `rust/crates/api/admin` 与 `rust/crates/api/public` 的路由字面量）。")
lines.append("> 重新生成：`python tools/gen-backend-api-md.py`（或参照本文档头部说明的提取脚本）。")
lines.append("")
lines.append("## 基础地址")
lines.append("")
lines.append("| 环境 | Admin API（后台） | Public API（商城前台） |")
lines.append("|------|------------------|----------------------|")
lines.append("| 生产 | `https://admin.recy.cc/adminapi` / `https://battery.recy.cc/adminapi` | `https://battery.recy.cc/api` |")
lines.append("| 本地 Rust | `http://127.0.0.1:8080/adminapi` | `http://127.0.0.1:8181/api` |")
lines.append("| admin-semi dev 代理 | `http://127.0.0.1:3002/adminapi` → 生产 | — |")
lines.append("")
lines.append("其他入口：")
lines.append("")
lines.append("- 健康检查：`/adminapi/health`、`/api/health`")
lines.append("- 静态资源 / 上传文件：`/static`（生产由 8181 提供）")
lines.append("- SSE 消息流：`GET /adminapi/msg/adminMsg/msgCount?startTime=`（nginx 需关闭缓冲）")
lines.append("- WebSocket（客服 IM）：`/ws`、`/im`（nginx 层反代）")
lines.append("- 鉴权：除登录/健康检查外均需 `Authorization: Bearer <token>`；登录需先 `POST /adminapi/common/csrf/create` 取 CSRF Token")
lines.append("")
lines.append(f"## Admin API（`/adminapi`，共 {len(admin)} 条）")
lines.append("")
lines.append(group_table(admin))
lines.append(f"## Public API（`/api`，共 {len(public)} 条）")
lines.append("")
lines.append(group_table(public))
if other:
    lines.append(f"## 其他路径（共 {len(other)} 条）")
    lines.append("")
    lines.append(group_table(other))

os.makedirs(os.path.dirname(OUT), exist_ok=True)
open(OUT, "w", encoding="utf-8", newline="\n").write("\n".join(lines) + "\n")
print(f"admin={len(admin)} public={len(public)} other={len(other)} -> {OUT}")
