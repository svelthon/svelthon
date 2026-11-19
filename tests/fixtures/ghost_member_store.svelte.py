from ghost_source import visible


def report():
    return visible + "|" + str("ghost" in globals())
