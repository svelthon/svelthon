# Instances written into JavaScript objects and arrays, then exported, returned
# and handed back.
__all__ = ["config", "make", "rows", "same"]


class Point:
    def __init__(self, x):
        self.x = x

    def double(self):
        return self.x * 2


point = Point(1.5)

config = js.Object.new()
config.inst = point

rows = js.Array.new()
rows.push(Point(2.5))


def make():
    made = js.Object.new()
    made.inst = Point(3.5)
    return made


def same(value):
    return value is point
