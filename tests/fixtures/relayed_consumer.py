# What a Python module makes of the functions `relayed_source.js` hands on,
# by name and through its object, beside the same imported from Python.
__js__ = {"./relayed_source.js": ["identity", "describe", "currency", "holder", "echo"]}
__all__ = ["named", "held", "direct", "javascript"]

from relayed_source import identity as original, describe as described, currency as priced, Price, Label


def answers(identity, describe, currency):
    price = Price(0.5)
    label = Label("hello")

    try:
        field = currency(price)
    except AttributeError as error:
        field = type(error).__name__

    return [
        identity is original,
        describe(1.0),
        type(identity(price)).__name__,
        type(identity(label)).__name__,
        identity(price) is price,
        field,
    ]


def named():
    return answers(identity, describe, currency)


def held():
    return answers(holder.identity, holder.describe, holder.currency)


def direct():
    return answers(original, described, priced)


def javascript():
    return type(echo(0.5)).__name__
