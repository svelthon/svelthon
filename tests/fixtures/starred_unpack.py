# Unpacking a row too short for a starred target: what the error says it needs.
__all__ = ["around", "leading"]


def around(row):
    try:
        first, *middle, last = row
    except ValueError as error:
        return str(error)


def leading(row):
    try:
        *first, second, third = row
    except ValueError as error:
        return str(error)
