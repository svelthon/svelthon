# What a component imports with `from starred_rows import *`.
__all__ = ["rows", "label"]

rows = []


def label():
    return "from the module"
