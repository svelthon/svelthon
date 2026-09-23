<script module>
import { record } from './lifecycle_log.js';
</script>
<script lang="python">
# A child taken out of its container, then mutated.
kind: str = "list"
child = []
rows = [child] if kind == "list" else {"child": child}


@effect
def observe():
    record(len(rows))


def detach():
    rows.clear()


def mutate():
    child.append(1)
</script>

<button data-k="detach" onclick={detach}>detach</button>
<button data-k="mutate" onclick={mutate}>mutate</button>
<p>{len(child)}</p>
