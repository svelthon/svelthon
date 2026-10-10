# Sets a module publishes, which cross as views: one per case, since each case
# writes on the one it reads.
__all__ = ["replaced", "own", "bind_null", "bind_other", "unchanged"]

replaced = {1, 2}
own = {1, 2}
bind_null = {1, 2}
bind_other = {1, 2}
unchanged = {1, 2}
