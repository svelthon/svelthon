# Text holding a character past U+FFFF, which Brython stores as a `String`
# object rather than a JavaScript string, alone and inside a str subclass.
__all__ = ["globe", "give", "tagged"]

globe = "🌍"


def give():
    return "🌍"


class Tag(str):
    pass


tagged = Tag("🌍")
