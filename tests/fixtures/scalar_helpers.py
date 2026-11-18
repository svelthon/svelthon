# A business type derived from a scalar, meeting every slot in this file's
# helpers that reads one: the value they format, and the options they format it
# with. Two rows, the derived types and the exact ones, and nothing else differs.
__all__ = ["says", "controls", "LABELS"]


class Stamp(float):
    pass


class Count(int):
    pass


class Text(str):
    pass


LABELS = [
    "date(value)",
    "from_now(value)",
    "date(text value)",
    "from_now(text value)",
    "batch(size)",
    "date(dateStyle)",
    "date(timeStyle)",
    "date(locale)",
    "from_now(locale)",
    "to_json(indent)",
]

WHEN = "2026-01-02T12:00:00Z"


def attempt(run):
    # A refusal is an answer too, and the two rows have to give the same one:
    # half of these slots failed by raising and half by silently formatting the
    # default, so a cell that can only hold a value would miss the quiet half.
    try:
        return run()
    except Exception as error:
        return type(error).__name__ + ": " + str(error)


def slots(number, count, text):
    # One call per slot, in the order a template would reach them.
    return [
        attempt(lambda: date(number(0.0))),
        attempt(lambda: from_now(number(0.0))),
        attempt(lambda: date(text(WHEN))),
        attempt(lambda: from_now(text(WHEN))),
        attempt(lambda: str(batch([1, 2, 3], count(2)))),
        attempt(lambda: date(0.0, text("full"), None, "en-US")),
        attempt(lambda: date(0.0, None, text("short"), "en-US")),
        attempt(lambda: date(0.0, "full", None, text("fr-FR"))),
        attempt(lambda: from_now(0.0, text("fr-FR"))),
        attempt(lambda: to_json({"a": [1]}, count(2))),
    ]


def says():
    return slots(Stamp, Count, Text)


def controls():
    # The exact types beside them, which were never in doubt.
    return slots(float, int, str)
