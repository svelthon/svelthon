from ghost_source import *


def report():
    return visible + "|" + globals().get("ghost", "absent")
