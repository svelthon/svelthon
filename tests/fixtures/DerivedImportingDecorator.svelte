<script lang="python">
# A decorator above `@derived` that imports a store for the first time: the
# store's own declarations mark their namespace, not this one, whose binding
# is still the declaration's.
base = 1


def importing(fn):
    import marked_store

    return fn


@importing
@derived
def doubled():
    return base * 2


@export
def held():
    import marked_store

    return f"{doubled} {marked_store.tripled}"


@export
def bump():
    global base
    base += 1
</script>

<p data-k="shown">{doubled}</p>
