# What a component imports with `from starred_plain import *`: no `__all__`,
# so every name that does not start with an underscore.
rows = []
_hidden = "private"


def label():
    return "from the module"
