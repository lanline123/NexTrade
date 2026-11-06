#!/usr/bin/env python3
"""把 pc-semi 路由目录的大小写统一成磁盘实际大小写，并生成一个提交。

背景：Windows 大小写不敏感，仓库里历史路径可能是 `List`，磁盘上是 `list`。
Linux 上 Next.js 按仓库大小写生成路由，导致应用内的 `/member/xxx/list` 链接 404。

做法：
1. 取 origin/main 的文件列表；
2. 逐段解析磁盘真实大小写（os.scandir 返回实际大小写）；
3. 对大小写不一致的路径，在临时 index 里删除旧路径、按磁盘大小写新增；
4. write-tree / commit-tree / push。
"""
import os
import subprocess
import sys
import tempfile

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SCOPE = "rust/web/pc-semi"
os.chdir(REPO)


def git(*args, env=None, check=True):
    r = subprocess.run(["git", *args], capture_output=True, text=True, env=env)
    if check and r.returncode != 0:
        raise SystemExit(f"git {' '.join(args)} failed: {r.stderr.strip()}")
    return r.stdout.strip()


def resolve_disk_case(rel_path):
    """返回磁盘上的真实大小写路径；不存在返回 None。"""
    parts = rel_path.split("/")
    current = ""
    for i, seg in enumerate(parts):
        parent = current or "."
        try:
            entries = os.listdir(parent)
        except OSError:
            return None
        match = None
        for name in entries:
            if name.lower() == seg.lower():
                match = name
                break
        if match is None:
            return None
        current = os.path.join(current, match) if current else match
    return current.replace("\\", "/")


def main():
    git("fetch", "origin", "main", "--quiet")
    remote_paths = git("ls-tree", "-r", "origin/main", "--name-only", SCOPE).splitlines()
    remote_paths = [p for p in remote_paths if p]

    renames = []
    for path in remote_paths:
        if not os.path.exists(path):
            continue
        actual = resolve_disk_case(path)
        if actual and actual != path:
            renames.append((path, actual))

    print(f"remote files: {len(remote_paths)}, case-renames: {len(renames)}")
    for old, new in renames[:10]:
        print(f"  {old}  ->  {new}")
    if not renames:
        print("nothing to rename")
        return

    idx = os.path.join(tempfile.gettempdir(), "casefix.idx")
    if os.path.exists(idx):
        os.remove(idx)
    env = dict(os.environ, GIT_INDEX_FILE=idx)
    git("read-tree", "origin/main", env=env)

    for old, new in renames:
        blob = git("hash-object", "-w", "--", new)
        git("update-index", "--force-remove", "--", old, env=env)
        git("update-index", "--add", "--cacheinfo", f"100644,{blob},{new}", env=env)

    tree = git("write-tree", env=env)
    base = git("rev-parse", "origin/main")
    msg = "fix(pc-semi): normalize route path casing to match app links\n\n" + "\n".join(
        f"- {o} -> {n}" for o, n in renames[:40]
    )
    commit = git(
        "-c", "user.name=nex", "-c", "user.email=nex@local",
        "commit-tree", tree, "-p", base, "-m", msg,
    )
    print(f"tree={tree} commit={commit}")
    push = subprocess.run(["git", "push", "origin", f"{commit}:main"], capture_output=True, text=True)
    print(push.stdout.strip() or push.stderr.strip())
    if push.returncode != 0:
        raise SystemExit(1)
    print("pushed")


if __name__ == "__main__":
    main()
