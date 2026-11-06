#!/usr/bin/env python3
"""Compare Java v5.8.61 controller routes with Rust route literals."""
import json
import os
import re
import sys

ROOT = r"D:\tigshop"
JAVA = os.environ.get(
    "JAVA_SRC",
    os.path.join(
        ROOT,
        "java-b2b2c-overseas-v5.8.61-d0fd28bcce96-4b28228ec4ff43febb4caff86778577c",
    ),
)
# Rust 源码在仓库内：<repo>/rust/crates，按脚本位置定位，允许 RUST_SRC 覆盖
REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RUST = os.environ.get("RUST_SRC", os.path.join(REPO, "rust", "crates"))

ANNOT = re.compile(
    r"@(Get|Post|Put|Delete|Patch)Mapping\s*(?:\(\s*(?:value\s*=\s*)?\{?\s*\"([^\"]*)\")?"
)
REQ = re.compile(
    r"@RequestMapping\s*\(\s*(?:value\s*=\s*)?\{?\s*\"([^\"]*)\"[^)]*?(?:RequestMethod\.(GET|POST|PUT|DELETE|PATCH))?",
    re.S,
)


def normalize(path: str) -> str:
    path = path.strip()
    path = re.sub(r"//+", "/", path)
    if not path.startswith("/"):
        path = "/" + path
    if path.endswith("/") and path != "/":
        path = path.rstrip("/")
    path = path.replace("/api/", "/", 1) if path.startswith("/api/") else path
    path = path.replace("/adminapi/", "/", 1) if path.startswith("/adminapi/") else path
    return path


def java_routes(path: str):
    try:
        text = open(path, encoding="utf-8").read()
    except Exception:
        return []
    base_match = re.search(r"@RequestMapping\s*\(\s*\(?\s*(?:value\s*=\s*)?\{?\s*\"([^\"]*)\"", text)
    base = base_match.group(1) if base_match else ""
    out = []
    for m in ANNOT.finditer(text):
        method = m.group(1).upper()
        sub = m.group(2) or ""
        full = "/" + "/".join(x.strip("/") for x in (base, sub) if x.strip("/"))
        out.append((method, full))
    # @RequestMapping with RequestMethod on methods
    for m in REQ.finditer(text):
        sub = m.group(1)
        method = (m.group(2) or "").upper()
        if not method or not sub:
            continue
        full = "/" + "/".join(x.strip("/") for x in (base, sub) if x.strip("/"))
        out.append((method, full))
    return out


def scan_java():
    routes = set()
    for module in ("tigshop-api", "tigshop-adminapi"):
        root = os.path.join(JAVA, module, "src", "main", "java")
        if not os.path.isdir(root):
            continue
        for dirpath, _, files in os.walk(root):
            for name in files:
                if not name.endswith(".java"):
                    continue
                for method, path in java_routes(os.path.join(dirpath, name)):
                    routes.add((method, normalize(path)))
    return routes


def scan_rust():
    found = set()
    string_route = re.compile(
        r"route\(\s*\"([^\"]+)\"\s*,\s*(get|post|put|delete|patch)\("
    )
    tuple_route = re.compile(r"\(\s*\"(GET|POST|PUT|DELETE|PATCH)\"\s*,\s*\"([^\"]+)\"\s*,")
    chained_get_post = re.compile(r"route\(\s*\"([^\"]+)\"\s*,\s*get\([^)]*\)\.post\(")
    chained_post_get = re.compile(r"route\(\s*\"([^\"]+)\"\s*,\s*post\([^)]*\)\.get\(")
    for module in ("api/public/src", "api/admin/src"):
        root = os.path.join(RUST, *module.split("/"))
        if not os.path.isdir(root):
            continue
        for dirpath, _, files in os.walk(root):
            for name in files:
                if not name.endswith(".rs"):
                    continue
                text = open(os.path.join(dirpath, name), encoding="utf-8", errors="ignore").read()
                for m in string_route.finditer(text):
                    found.add((m.group(2).upper(), normalize(m.group(1))))
                for m in tuple_route.finditer(text):
                    found.add((m.group(1).upper(), normalize(m.group(2))))
                for m in chained_get_post.finditer(text):
                    found.add(("GET", normalize(m.group(1))))
                    found.add(("POST", normalize(m.group(1))))
                for m in chained_post_get.finditer(text):
                    found.add(("POST", normalize(m.group(1))))
                    found.add(("GET", normalize(m.group(1))))
    return found


def main():
    j = scan_java()
    r = scan_rust()
    def route_regex(path):
        escaped = re.escape(re.sub(r"\{[^}]+\}", "*", path))
        return re.compile("^" + escaped.replace(r"\*", "[^/]+") + "$")

    rust_by_method = {}
    for method, path in r:
        rust_by_method.setdefault(method, []).append((path, route_regex(path)))

    def matched(method, path):
        if (method, path) in r:
            return True
        for _, rx in rust_by_method.get(method, []):
            if rx.match(path):
                return True
        return False

    missing = sorted((m, p) for m, p in j if not matched(m, p))
    extra = sorted(r - j)
    print(f"java_routes={len(j)} rust_routes={len(r)} missing={len(missing)} extra={len(extra)}")
    out = {
        "java_count": len(j),
        "rust_count": len(r),
        "missing_count": len(missing),
        "missing": [{"method": m, "path": p} for m, p in missing],
        "extra_count": len(extra),
        "extra_sample": [{"method": m, "path": p} for m, p in extra[:100]],
    }
    with open(os.path.join(REPO, "docs", "rust-v5.8.61-route-diff.json"), "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, indent=2)
    for m, p in missing[:80]:
        print(f"{m:6} {p}")


if __name__ == "__main__":
    main()
