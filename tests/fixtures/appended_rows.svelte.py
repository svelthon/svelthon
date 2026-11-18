"""A store whose function appends the row JavaScript hands it."""

rows = []


def add(row):
    rows.append(row)


def first_n():
    return rows[0]["n"]
