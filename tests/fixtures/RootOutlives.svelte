<script module>
import { record, events } from './lifecycle_log.js';

let kept = {};
export const held = () => kept;
const capture = (mutate, stop) => {
    kept = { mutate, stop };
};
</script>
<script lang="python">
# A root that reads a list, and a way to mutate the list after the component
# is gone.
rows = []


@effect.root
def stop_rows():
    record(len(rows))


def mutate():
    rows.append(1)


def on_mount():
    capture(mutate, stop_rows)
</script>

<p>{len(rows)}</p>
