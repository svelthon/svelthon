"""A store with a root effect, its destructor, and a derived over rows."""

count = 0
rows = [{"done": False}, {"done": False}]
last = -1


@derived
def remaining():
    return len([row for row in rows if not row["done"]])


@effect.root
def journal():
    global last
    last = count


def bump():
    global count
    count += 1


def finish_first():
    rows[0]["done"] = True


def stop():
    # The decorated name holds the destructor.
    journal()
