<script module>
import { record, recordOld } from './rebound_log.js';
</script>
<script lang="python">
# `old` keeps the first list after `rows` is rebound to another one.
rows = []
old = rows


@effect
def watch():
    record(len(rows))


@effect
def watch_old():
    recordOld(len(old))


def replace():
    global rows
    rows = [1]


def mutate_old():
    old.append(2)


def mutate_current():
    rows.append(2)
</script>

<button data-k="replace" onclick={replace}>replace</button>
<button data-k="old" onclick={mutate_old}>old</button>
<button data-k="current" onclick={mutate_current}>current</button>
<p>{rows}</p>
