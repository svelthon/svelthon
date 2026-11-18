"""A store whose rows JavaScript hands, keeps and moves from a name to another."""

rows = []
meta = {}
kept = {}


def total():
    return sum(row["n"] for row in rows)


def size():
    return len(rows)


def same():
    return rows[0] is rows[1]


def write_first(n):
    rows[0]["n"] = n


def second_n():
    return rows[1]["n"]


def holds_itself():
    return rows[0]["self"] is rows[0]


def first():
    return rows[0]


def keep_first():
    kept["first"] = rows[0]


def resort():
    global rows
    rows = sorted(rows, key=lambda row: -row["n"])
