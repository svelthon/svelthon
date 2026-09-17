<script lang="python">
# An operation taken off the **type**, kept as a value, and given its target at
# the call. The witness calls the same operation through the type in place.
rows = []
other = []

add = list.append


def by_kept():
    add(rows, 1)


def by_direct():
    list.append(other, 1)


def kept():
    return len(rows)


def direct():
    return len(other)


def kind():
    # What Python sees of the adapted descriptor, beside one it does not adapt.
    return [type(list.append).__name__, type(list.copy).__name__]


def owner():
    return [list.append.__objclass__.__name__, list.copy.__objclass__.__name__]
</script>

<button data-k="kept" onclick={by_kept}>kept</button>
<button data-k="direct" onclick={by_direct}>direct</button>
<p data-k="kept-total">{kept()}</p>
<p data-k="direct-total">{direct()}</p>
<p data-k="kind">{kind()}</p>
<p data-k="owner">{owner()}</p>
