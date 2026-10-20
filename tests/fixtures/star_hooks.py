# The hooks a component takes with `from star_hooks import *`, which binds
# names no statement of the component lists.
__js__ = {"./star_records.js": ["record"]}
__all__ = ["on_mount", "on_destroy"]


def on_mount():
    record("mount")
    return lambda: record("cleanup")


def on_destroy():
    record("destroy")
