# Sorting compares with < alone, and keeps equal items in their order: what
# each sort answered, as `python3` answers on this module.
__all__ = ["answers"]


def answers():
    class OnlyLess:
        def __init__(self, n, name):
            self.n = n
            self.name = name

        def __lt__(self, other):
            return self.n < other.n

        def __eq__(self, other):
            raise AssertionError("sorting asked ==")

    items = [OnlyLess(2, "a"), OnlyLess(1, "b"), OnlyLess(2, "c")]

    return [
        "".join(x.name for x in sorted(items)),
        "".join(x.name for x in sorted(items, reverse=True)),
        "".join(x.name for x in sorted(items, key=lambda x: x)),
    ]


if __name__ == "__main__":
    print(answers())
