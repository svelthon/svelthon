# What Python sees of a value, asked identically of a local value and of its
# twin from another JavaScript context. The two answers have to be the same
# string, whatever that string is.
__js__ = {
    "./another_context.js": [
        "foreignObject",
        "localObject",
        "foreignDate",
        "localDate",
        "foreignURL",
        "localURL",
        "foreignMap",
        "localMap",
    ]
}
__all__ = ["seen", "MAKERS"]

MAKERS = {
    "object": [foreignObject, localObject],
    "date": [foreignDate, localDate],
    "url": [foreignURL, localURL],
    "map": [foreignMap, localMap],
}


def attempt(run):
    try:
        return run()
    except Exception as error:
        return type(error).__name__


def seen(kind, foreign):
    # One value, every question this project asks of a JavaScript value: what it
    # becomes as Python, what a mapping helper writes of it, and what it
    # serialises to. A refusal is an answer too, and both sides have to give it.
    value = MAKERS[kind][0 if foreign else 1]()
    converted = to_py(value)

    return [
        type(converted).__name__,
        attempt(lambda: str(converted.get("answer"))),
        attempt(lambda: urlencode(value)),
        attempt(lambda: tojson(value)),
    ]
