#!/usr/bin/env python3
"""Keep the frontier-question log in shape (stdlib only).

    fq.py [--log PATH] [--agent PATH] index   rewrite ## Open and ## Closed, and
                                              the open list inside AGENT.md
    fq.py [--log PATH] [--agent PATH] check   exit 1 on a stale index or a bad block
    fq.py [--log PATH] next                   print the next free FQ number

Each question is a `## FQn` section whose first line is `status: ...`, then an
optional `intent: ...` line (at most 72 characters). The `**Status:**` line may
say `depends on X; associated with Y`; those become the second index line.
"""
import argparse
import re
import sys
from pathlib import Path

WIDTH = 80
INTENT_MAX = 72
OPEN = ("answered in part", "deferred", "open")
CLOSED = ("answered", "closed", "retracted")
HEAD = re.compile(r"^## FQ(\d+)\s*$")
MARK = ("<!-- fq:open:start -->", "<!-- fq:open:end -->")


def clip(text, width):
    return text if len(text) <= width else text[: width - 1].rstrip() + "…"


def parse(text):
    lines = text.split("\n")
    first = next((i for i, l in enumerate(lines) if HEAD.match(l)), len(lines))
    top = next((i for i, l in enumerate(lines) if l == "## Open"), first)
    header = "\n".join(lines[: min(top, first)]).rstrip("\n")
    blocks, cur = [], None
    for line in lines[first:]:
        if line.startswith("## "):
            m = HEAD.match(line)
            cur = {"num": int(m.group(1)), "lines": []} if m else None
            if cur:
                blocks.append(cur)
        elif cur is not None:
            cur["lines"].append(line)
    return header, blocks


def fields(b):
    ls = b["lines"]
    b["errors"] = []
    if not ls or not ls[0].startswith("status:"):
        b["errors"].append("first line must be 'status: ...'")
        b["kind"], b["intent"], b["status"], b["question"] = "", "", "", ""
        return
    word = re.split(r"[;:(]", ls[0][len("status:"):])[0].strip().lower()
    b["kind"] = "open" if word in OPEN else "closed" if word in CLOSED else ""
    if not b["kind"]:
        b["errors"].append(f"unknown status {word!r}")
    rest = ls[1:]
    b["intent"] = ""
    if rest and rest[0].startswith("intent:"):
        b["intent"] = rest[0][len("intent:"):].strip()
        rest = rest[1:]
    b["question"] = next((l for l in rest if l.strip() and not l.startswith("**Status:**")), "")
    b["status"] = next((l[len("**Status:**"):].strip() for l in reversed(rest) if l.startswith("**Status:**")), "")
    if len(b["intent"]) > INTENT_MAX:
        b["errors"].append(f"intent is {len(b['intent'])} characters, at most {INTENT_MAX}")


def entry(b):
    intent = b["intent"] or clip(re.split(r"(?<=[.?!])\s", b["question"])[0], INTENT_MAX)
    out = [f"- FQ{b['num']} {intent}"]
    st = b["status"]
    parts = []
    dep = re.search(r"depends on ([^;]+)", st)
    see = re.search(r"associated with (.+)$", st)
    if dep:
        parts.append("dep " + dep.group(1).strip())
    if see:
        parts.append("see " + see.group(1).strip().rstrip("."))
    if not parts and b["kind"] == "closed" and ":" in st:
        parts.append(st.split(":", 1)[1].strip())
    if parts:
        out.append("  " + clip("; ".join(parts), WIDTH - 2))
    return out


def render(header, blocks):
    out = [header, ""]
    for title, kind in (("Open", "open"), ("Closed", "closed")):
        out += [f"## {title}", ""]
        rows = [entry(b) for b in blocks if b["kind"] == kind]
        out += [l for r in rows for l in r] or ["(none)"]
        out.append("")
    for b in blocks:
        out += [f"## FQ{b['num']}"] + b["lines"]
        while out[-1] == "":
            out.pop()
        out.append("")
    return "\n".join(out)


def open_list(blocks):
    nums = [f"FQ{b['num']}" for b in blocks if b["kind"] == "open"]
    nxt = max(b["num"] for b in blocks) + 1 if blocks else 1
    body, line = [], "Open:"
    for n in nums:
        if len(line) + 1 + len(n) > 150:
            body.append(line)
            line = "      "
        line += " " + n
    body.append(line)
    return "\n".join([MARK[0], f"Next free FQ number: {nxt}.", *body, MARK[1]])


def patch_agent(text, blocks):
    a, z = text.find(MARK[0]), text.find(MARK[1])
    if a < 0 or z < a:
        return text
    return text[:a] + open_list(blocks) + text[z + len(MARK[1]):]


def find_log(arg):
    for c in ([Path(arg)] if arg else [Path("frontier-question-log.md"), Path("../frontier-question-log.md")]):
        if c.is_file():
            return c
    sys.exit("fq.py: no frontier-question-log.md here or one level up; pass --log")


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--log")
    ap.add_argument("--agent")
    ap.add_argument("cmd", choices=("index", "check", "next"))
    args = ap.parse_args()
    log = find_log(args.log)
    header, blocks = parse(log.read_text())
    for b in blocks:
        fields(b)
    if args.cmd == "next":
        print(max(b["num"] for b in blocks) + 1)
        return
    agent = Path(args.agent) if args.agent else log.parent / "swurm" / "AGENT.md"
    new_log = render(header, blocks)
    new_agent = patch_agent(agent.read_text(), blocks) if agent.is_file() else None
    if args.cmd == "index":
        log.write_text(new_log)
        if new_agent is not None:
            agent.write_text(new_agent)
        return
    errs = [f"FQ{b['num']}: {e}" for b in blocks for e in b["errors"]]
    nums = [b["num"] for b in blocks]
    if nums != sorted(set(nums)):
        errs.append("FQ numbers must be unique and in increasing order")
    if new_log != log.read_text():
        errs.append(f"{log} is stale; run: fq.py index")
    if new_agent is not None and new_agent != agent.read_text():
        errs.append(f"{agent} open list is stale; run: fq.py index")
    for l in new_log.split("\n"):
        if l.startswith("## FQ"):
            break
        if l.startswith(("- FQ", "  ")) and len(l) > WIDTH:
            errs.append(f"index line over {WIDTH} columns: {l[:40]}...")
    print("\n".join(errs) or "ok")
    sys.exit(1 if errs else 0)


if __name__ == "__main__":
    main()
