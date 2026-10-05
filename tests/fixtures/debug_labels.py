# Debug fields of f-strings, `{x=}`, whose label the tokenizer reads off the
# source: after a literal with a conversion, and around an f-string of its own.


class Row:
    pass


row = Row()
row.name = "ok"


def converted():
    return [f"before:{row.name=!s}", f"before:{row.name=!r}"]


def nested():
    return f"{f'{row.name=}'=}"
