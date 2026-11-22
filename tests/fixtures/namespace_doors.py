# What reaches a module's namespace by an attribute, which the text cannot tell
# from an object's: refused as it is written, at run time. And what only looks
# like a door, a parameter named `globals`, a `vars` of the module's own, an
# instance's `f_globals`, written as Python writes it.
import builtins

__all__ = ["attempts", "ordinary"]


def f():
    pass


def tried(write):
    try:
        write()
        return "written"
    except TypeError:
        return "refused"


def through_function():
    f.__globals__["y"] = 2


def through_frame():
    try:
        raise ValueError()
    except ValueError as error:
        error.__traceback__.tb_frame.f_globals["y"] = 2


def through_builtins():
    builtins.globals()["y"] = 2


attempts = [tried(through_function), tried(through_frame), tried(through_builtins)]

data = {}
mine = {}


def apply(globals):
    globals().update(status="published")


def vars():
    return mine


class Record:
    pass


snapshot = Record()
snapshot.f_globals = {}

apply(lambda: data)
vars()["kind"] = "own"
snapshot.f_globals["field"] = 1
ordinary = [data["status"], mine["kind"], snapshot.f_globals["field"]]
