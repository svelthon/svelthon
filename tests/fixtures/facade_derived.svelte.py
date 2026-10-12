# A reactive module with a derived spelled like its `store` object.
base = 7


@derived
def store():
    return base
