# Text holding a character past U+FFFF, which Brython stores as a `String`
# object rather than a JavaScript string.
__all__ = ["globe", "give"]

globe = "🌍"


def give():
    return "🌍"
