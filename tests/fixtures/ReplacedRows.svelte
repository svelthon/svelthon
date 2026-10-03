<script lang="python">
def as_list(fn):
    return []


@as_list
def decorated():
    return None


def assigned():
    return None


assigned = []


def grow():
    decorated.append(7)
    assigned.append(7)
</script>

<button data-k="grow" onclick={grow}>grow</button>
<p data-k="decorated">{len(decorated)}</p>
<p data-k="assigned">{len(assigned)}</p>
