# JavaScript imports spelled like Python builtins, read at the top level, in a
# function, in a class body, in a comprehension and in a lambda.
__js__ = {"./builtin_names.js": ["max", "object"]}

top = max(1, 2)


class Box:
    made = object()


def reads():
    return [top, max(3), Box.made, [max() for _ in range(1)][0], (lambda: object())()]


# A builtin no import names is still the builtin.
def untouched():
    return [str(min(1, 2)), str(len("abc"))]
