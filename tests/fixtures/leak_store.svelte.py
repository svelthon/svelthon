__all__ = ["rows", "live"]

# The shared container everyone reads, and the roll call the children keep
# themselves: one entry per mounted child, removed on unmount.
rows = []
live = []
