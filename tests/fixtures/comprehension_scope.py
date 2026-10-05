# A comprehension has a scope of its own: the names it binds are never the
# module's, a function made in it keeps them, and a class body's names are not
# its own.
__all__ = ["module_level", "late", "class_level"]

seen = [globals().get("x", "absent") for x in range(2)]


def module_level():
    return seen


def late():
    made = [lambda: y for y in range(3)]
    return [one() for one in made]


def class_level():
    try:
        class Holder:
            factor = 3
            doubled = [i * factor for i in range(2)]

        return Holder.doubled
    except NameError as error:
        return str(error)
