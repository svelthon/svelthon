# t-strings, one function per repair of the vendored Brython, each answering
# what CPython 3.14 answers. The classes are read off a template, since the
# standard library, and `string.templatelib` with it, does not ship.
name = "Ada"
x = 3.14159
greeting = t"Hello {name}"
Template = type(t"")
Interpolation = type(t"{0}".interpolations[0])


def described():
    [field] = greeting.interpolations
    return f"{greeting.strings[0]}|{field.value}|{field.expression}|{field.conversion}"


def formatted():
    return t"{x:.2f}".interpolations[0].format_spec


def ended():
    return t"Hello {name!r}".strings


def expressed():
    return t"{1 + 2}".interpolations[0].expression


def shown():
    return repr(t"a")


def joined():
    return (t"a{name!r}" + t"b").strings


def typed():
    return f"{Template!r}|{Interpolation!r}|{Template.__name__}"


def defaulted():
    return repr(Interpolation(1, "x"))


def matched():
    match t"{name!r:^9}".interpolations[0]:
        case Interpolation(value, expression, conversion, format_spec):
            return (value, expression, conversion, format_spec)


def made():
    return Template("a", Interpolation(1, "x"), "b", "c").strings


def iterated():
    template = t"a{1}b"
    first, second = iter(template), iter(template)
    return (next(first), next(first).value, next(second), list(template)[2])
