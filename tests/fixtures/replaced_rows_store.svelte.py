# Lists where a `def` stood, put there by a decorator and by a later line.
def as_list(fn):
    return []


@as_list
def decorated():
    return None


def assigned():
    return None


assigned = []


def grow():
    decorated.append(7)
    assigned.append(7)


def replace():
    global decorated
    decorated = [1, 2]
