<script lang="python">
# A key whose `__hash__` logs each call, in a dict the page reads and in one
# nothing watches.
log = []


class Key:
    def __hash__(self):
        log.append("hash")
        return 7


key = Key()
tracked = {key: "yes"}


def counted(table, how):
    log.clear()
    if how == "setdefault":
        table.setdefault(key, "no")
    elif how == "pop":
        table.pop(key, "absent")
    else:
        table.update({key: "yes"})
    return len(log)


@export
def calls(how):
    # The same call on a dict nothing watches, then on the one the page reads.
    return [counted({key: "yes"}, how), counted(tracked, how)]
</script>

<output>{len(tracked)}</output>
