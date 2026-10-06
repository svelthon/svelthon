# Every mutable shape a module exports, changed in place by the module.
__all__ = ["items", "record", "nested", "rows", "table", "thing", "mutate", "seen"]


class Rows(list):
    pass


class Table(dict):
    pass


class Thing:
    def __init__(self):
        self.count = 0

    def double(self):
        return self.count * 2


items = [0]
record = {"count": 0}
nested = {"items": [0]}
rows = Rows([0])
table = Table(count=0)
thing = Thing()


def mutate():
    items.append(1)
    record["count"] = 1
    nested["items"].append(1)
    rows.append(1)
    table["count"] = 1
    thing.count = 1


# What Python reads now, for a write JavaScript made.
def seen():
    return {"items": list(items), "record": dict(record), "thing": thing.count}
