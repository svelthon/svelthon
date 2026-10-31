# A store whose function is marked `@export`, which a store publishes anyway:
# the marker changes nothing of what it publishes.
count = 0


@export
def bump():
    global count
    count += 1
    return count
