# A global deleted through globals() is no longer bound: reading it raises
# NameError, and a builtin it shadowed answers again.
count = 3
len = 5


def read():
    try:
        return str(count)
    except NameError:
        return "missing"


def drop():
    globals().pop("count")
    del globals()["len"]
    return f"{read()}|{len('ab')}"
