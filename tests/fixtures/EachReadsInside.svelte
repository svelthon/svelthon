<script lang="python">
# Rows a block computes by reading inside them, one way per `kind`, and a
# change inside one row that moves, drops or brings a row: the block shows
# what the computation gives now (`expected`).
importjs { jsN } from "./each_keys.js"
kind: str = "key"
rows = [{"meta": {"n": n}, "n": n, "on": True, "tags": ["a"], "notes": [], "label": label} for n, label in ((3, "x"), (1, "y"), (2, "z"))]
d = {"x": [3, "x"], "y": [1, "y"], "z": [2, "z"]}
chosen = [["a", "b"]]


class Box:
    limit = 0

    def __init__(self, n, label):
        self.n = n
        self.label = label
        self.parts = [n]

    @property
    def total(self):
        return sum(self.parts)


boxes = [Box(3, "x"), Box(1, "y"), Box(2, "z")]


def matched(row):
    match row:
        case {"meta": {"n": 0}}:
            return True
        case _:
            return False


def computed():
    if kind == "key":
        return sorted(rows, key=lambda r: r["n"])
    if kind == "nested":
        return sorted(rows, key=lambda r: r["meta"]["n"])
    if kind == "str":
        return sorted(rows, key=str)
    if kind == "format":
        return sorted(rows, key=lambda r: f"{r}")
    if kind == "filter":
        return [r for r in rows if r["on"]]
    if kind == "length":
        return [r for r in rows if len(r["tags"]) > 1]
    if kind == "member":
        return [r for r in rows if r["tags"] in chosen]
    if kind == "boxes":
        return sorted(boxes, key=lambda b: b.n)
    if kind == "values":
        return sorted(d.values())
    if kind == "items":
        return sorted(d.items(), key=lambda pair: pair[1][0])
    if kind == "js":
        return sorted(rows, key=jsN)
    if kind == "max":
        return [max(rows, key=lambda r: r["n"])]
    if kind == "any":
        return [r for r in rows if any(t == "b" for t in r["tags"])]
    if kind == "join":
        return [r for r in rows if "".join(r["tags"]) == "ab"]
    if kind == "sum":
        return [r for r in rows if sum(r["meta"].values()) == 0]
    if kind == "percent":
        return [r for r in rows if "%s" % (r["tags"],) == "['a', 'b']"]
    if kind == "unpack":
        return [r for r in rows if [*r["tags"]] == ["a", "b"]]
    if kind == "match":
        return [r for r in rows if matched(r)]
    if kind == "slice":
        return [r for r in rows if r["tags"][1:]]
    if kind == "truth":
        return [r for r in rows if r["notes"]]
    if kind == "sumattr":
        return [b for b in boxes if sum(b.parts) > 0]
    if kind == "maxattr":
        return [b for b in boxes if max(b.parts) > 0]
    if kind == "property":
        return sorted(boxes, key=lambda b: b.total)
    if kind == "classattr":
        return [b for b in boxes if b.n >= b.limit]
    return [r for r in rows if "extra" in r]


def label(row):
    if isinstance(row, Box):
        return row.label
    if isinstance(row, dict):
        return row["label"]
    return row[1] if isinstance(row, list) else row[0]


@export
def step():
    if kind in ("key", "str", "format", "js", "max"):
        rows[0]["n"] = 0
        rows[0]["meta"]["n"] = 0
    elif kind in ("nested", "sum", "match"):
        rows[0]["meta"]["n"] = 0
    elif kind == "filter":
        rows[1]["on"] = False
    elif kind in ("length", "member", "any", "join", "percent", "unpack", "slice"):
        rows[2]["tags"].append("b")
    elif kind == "boxes":
        boxes[0].n = 0
    elif kind in ("values", "items"):
        d["x"][0] = 0
    elif kind == "truth":
        rows[1]["notes"].append("note")
    elif kind in ("sumattr", "property"):
        boxes[0].parts.append(-10)
    elif kind == "maxattr":
        boxes[0].parts[0] = -10
    elif kind == "classattr":
        Box.limit = 3
    else:
        rows[1]["extra"] = 1


@export
def expected():
    return " ".join(label(row) for row in computed())
</script>

{#each computed() as row}<span>{label(row)}</span>{/each}
