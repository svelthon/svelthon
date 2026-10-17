# Python functions a JavaScript module re-exports, `relayed_source.js`, and a
# float and a str of the author's they are handed.
__all__ = ["identity", "describe", "currency", "Price", "Label"]


def identity(value):
    return value


def describe(value):
    return f"{type(value).__name__}:{value}"


def currency(value):
    return value.currency


class Price(float):
    currency = "EUR"


class Label(str):
    pass
