<script lang="python">
# A set updated from a source that itself swaps one member for another, so the
# set ends as large as it began, called three ways.
kind: str = "update"
form: str = "method"

flags = {1, 2}
kept = flags.update if kind == "update" else flags.difference_update


def values():
    flags.remove(1)
    flags.add(3)
    yield 2 if kind == "update" else 9


@export
def change():
    if form == "kept":
        kept(values())
    elif form == "type":
        (set.update if kind == "update" else set.difference_update)(flags, values())
    elif kind == "update":
        flags.update(values())
    else:
        flags.difference_update(values())
</script>

<output>{",".join(str(one) for one in sorted(flags))}</output>
