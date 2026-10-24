# A plain module's derived follows nothing, so a value written to it is held
# for good.
base = 1


@derived
def doubled():
    return base * 2


def held():
    return doubled


def write(value):
    global doubled
    doubled = value


def bump():
    global base
    base += 1
