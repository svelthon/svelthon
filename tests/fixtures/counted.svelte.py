"""A store read and written from JavaScript, which is what a store is for.

Its published state carries a setter as well as a getter, and the setter is the
half no Python call ever goes through: `bump()` works whatever the setter says.
"""

count = 0
rows = []
price = 0.25


@derived
def doubled():
    return price * 2


def bump():
    global count
    count += 1


def bump_rows():
    rows.append("python")
