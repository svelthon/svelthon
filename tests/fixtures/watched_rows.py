"""Values a handler makes again and again in one job, under a watch: objects
of the author's in a set, and rows of data, dicts or lists holding a list, in a
list."""

__all__ = ["cells", "rows", "kept", "fill_cells", "fill_records", "fill_pairs", "keep_first_tags", "fresh_records",
           "first_tags", "empty"]


class Cell:
    def __init__(self, i):
        self.i = i


cells = set()
rows = []
kept = []


def fill_cells(n):
    cells.clear()
    for i in range(n):
        cells.add(Cell(i))


def fill_records(n):
    rows.clear()
    rows.extend({"id": i, "tags": [i]} for i in range(n))


def fill_pairs(n):
    rows.clear()
    rows.extend([i, [i]] for i in range(n))


def keep_first_tags():
    kept.append(rows[0]["tags"])


def fresh_records(n):
    return [{"id": i, "tags": [i]} for i in range(n)]


def first_tags(records):
    return records[0]["tags"]


def empty():
    cells.clear()
    rows.clear()
    kept.clear()
