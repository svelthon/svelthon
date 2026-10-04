# A t-string inside an f-string, in a module of its own: an engine that cannot
# parse it fails to compile this file, and only the test that imports it.
def nested():
    return f"<{t'a'!r}>"
