<script lang="python">
# `to_py` is the boundary in the other direction: a JavaScript value read as
# Python. Three shapes reach it and they are not the same question.
class Carte:
    # An ordinary serialisation helper, which is the shape that made `to_py`
    # raise: asking for `to_dict` unconditionally found a *bound method* on a
    # value that had not been converted at all.
    def __init__(self):
        self.n = 1

    def to_dict(self):
        return {"n": self.n}


already = {"python": 1}
carte = Carte()


def essai(faire):
    try:
        one = faire()
        return type(one).__name__ + ":" + str(one)
    except Exception as error:
        return "raises " + type(error).__name__ + ": " + str(error)


CASES = {
    # A JavaScript object, which is what the helper exists for.
    "converted": lambda: essai(lambda: to_py(js.JSON.parse('{"a": 1}'))),
    "array": lambda: essai(lambda: to_py(js.JSON.parse("[1, 2]"))),
    # Already Python: handed back as itself, `to_dict` never asked for.
    "already": lambda: essai(lambda: to_py(already)),
    "instance": lambda: essai(lambda: to_py(carte)),
    # A scalar, which crosses without a container around it.
    "number": lambda: essai(lambda: to_py(js.JSON.parse("0.25"))),
}


@export
def lire(quoi):
    return CASES[quoi]()
</script>

<p data-k="ready">ready</p>
