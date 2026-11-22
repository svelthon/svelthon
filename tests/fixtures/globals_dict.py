# globals() as CPython hands it over: the module's own dict, live, read here.
# Plain Python, so the same file answers the same under CPython.
count = 3
label = "x"


def kind():
    return f"{type(globals()).__name__}|{isinstance(globals(), dict)}|{globals() is globals()}"


def names():
    return ",".join(sorted(key for key in globals() if not key.startswith("__")))


def reads():
    found = globals()
    return (
        f"{'count' in found}|{'count' in list(found)}|{'count' in found.keys()}|"
        f"{found['count']}|{found.get('count')}|{found.copy()['count']}|{dict(found.items())['label']}|"
        f"{len(found) == len(list(found))}"
    )


if False:
    ghost = 1


def unbound():
    try:
        return str(ghost)
    except NameError:
        return "missing"


top_locals = locals() is globals()
top_dir = dir()


def top():
    return f"{top_locals}|{'count' in top_dir}|{'kind' in top_dir}|{'top' in top_dir}"


def restore():
    global count, label
    count = 3
    label = "x"
