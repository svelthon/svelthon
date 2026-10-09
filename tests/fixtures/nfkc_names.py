# Identifiers normalized to NFKC, as Python reads them: a ligature, a Roman
# numeral, a fullwidth letter and an accent written in two code points name what
# their plain spelling names. A string given to `getattr` is not normalized.
# `python3` on this module gives the lines the test expects.
__all__ = ["answers"]


class Box:
    def __init__(self):
        self.field = "field"
        self.café = "composed"


def answers():
    box = Box()
    decomposed = box.café
    ﬂag = "flag"
    Ⅷ = 8
    return [box.ﬁeld, flag, repr(VIII), ｆｕｌｌ(), decomposed, getattr(box, "ﬁeld", "missing")]


def full():
    return "full"
