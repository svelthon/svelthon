# A module binding names the generated code reached JavaScript's globals by.
__all__ = ["Object", "Error", "raised"]

Object = 10


class Error(Exception):
    pass


def raised():
    try:
        raise Error("mine")
    except Error as error:
        return type(error).__name__ + ": " + str(error)
