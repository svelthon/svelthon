<script lang="python">
# A key holding a NaN is equal to nothing but itself: replaced by a new one it
# makes a new block, put back as the same object it keeps its own.
kind: str = "complex_real"


class Complex(complex):
    pass


def make_key():
    nan = float("nan")
    return {
        "float": lambda: nan,
        "complex_real": lambda: complex(nan, 1),
        "complex_imag": lambda: complex(1, nan),
        "complex_zero": lambda: complex(nan, 0),
        "subclass": lambda: Complex(nan, 1),
        "tuple": lambda: (1, complex(nan, 1)),
        "frozenset": lambda: frozenset({complex(nan, 1)}),
        "finite": lambda: complex(2, 1),
    }[kind]()


key = make_key()


@export
def same_as_fresh():
    # Equality as a container finds it, identity first.
    return [key] == [make_key()]


@export
def replace():
    global key
    key = make_key()


@export
def put_back():
    global key
    key = key
</script>

{#key key}<input value="draft" />{/key}
