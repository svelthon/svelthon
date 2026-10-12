<script module>
import { record } from './lifecycle_log.js';
</script>
<script lang="python">
# Roots used while the body runs: one stopped by its name, one kept under
# another name and stopped later. A root's destructor is its name's as soon as
# its `def` has run.
count = 0


@effect.root
def stopped():
    js.String(count)
    record("stopped")


stopped()


@effect.root
def kept():
    js.String(count)
    record("kept")


saved = kept


def finish():
    saved()


def bump():
    global count
    count += 1
</script>

<button data-k="finish" onclick={finish}>finish</button>
<button data-k="bump" onclick={bump}>bump</button>
