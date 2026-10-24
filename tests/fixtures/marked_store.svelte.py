# A store a decorator imports for the first time: its own declarations run
# while the declaration of the component that imports it is under way.
base = 1


@derived
def tripled():
    return base * 3
