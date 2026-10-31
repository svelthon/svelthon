<script lang="python">
# The rows of an `{#each}` read from one list, then from another: a change
# inside the list read now is followed, and not one inside the list read before.
a = [1]
b = [2]
use_b = False


@export
def turn():
    global use_b
    use_b = True


@export
def grow():
    b.append(3)
</script>

<p data-k="rows">{#each (b if use_b else a) as x}{x}{/each}</p>
