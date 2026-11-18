# A type an author derives from a builtin scalar, which is how a domain value is
# written when it has to keep behaving like a number.
__all__ = [
    "price",
    "count",
    "label",
    "plain_float",
    "plain_int",
    "plain_str",
    "carried",
    "held",
    "reads_python",
    "as_json",
]


class Price(float):
    pass


class Count(int):
    pass


class Label(str):
    pass


class Rich(float):
    # The same, carrying a field of its own.
    def __init__(self, value):
        self.currency = "EUR"


price = Price(0.25)
count = Count(3)
label = Label("x")
carried = Rich(0.25)

plain_float = 0.25
plain_int = 3
plain_str = "x"

# One level down, where the walk meets it rather than the export.
held = {"amount": Price(0.25), "rows": [Count(3)]}


def reads_python():
    # Python's side: the subclass never stopped being a number there, which is
    # what says the loss was at the crossing and not in the model.
    return [
        isinstance(price, float),
        format(price, ".2f"),
        price + 0.25,
        carried.currency,
    ]


def as_json():
    return [to_json(price), to_json(held), to_json(plain_float)]
