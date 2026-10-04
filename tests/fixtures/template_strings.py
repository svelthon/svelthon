# A t-string whose field ends with a name, the commonest one, compiles, and
# what its interpolations hold is readable.
name = "Ada"
greeting = t"Hello {name}"


def described():
    [field] = greeting.interpolations
    return f"{greeting.strings[0]}|{field.value}|{field.expression}|{field.conversion}"
