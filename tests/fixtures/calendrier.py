# A little library of one's own, whose author had no idea Svelthon injects a
# helper called `date`. Nothing here should have to care.


def date(value):
    return "day " + str(value)


def batch(rows):
    return "rows: " + str(rows)
