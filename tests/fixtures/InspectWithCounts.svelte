<script lang="python">
# `inspect_with(logger, *values)` evaluates each role where Svelte does: the
# values when it inspects, the logger when it logs. The counters live outside
# the state, so measuring writes nothing reactive.
count = 0


def record(kind, value):
    js.globalThis.__inspectRecords.push([kind, value])


def read_value():
    js.globalThis.__inspectReads.push(count)
    return count


def make_logger():
    js.globalThis.__inspectLoggers.push("made")
    return record


inspect_with(make_logger(), read_value())


def bump():
    global count
    count += 1
</script>

<button data-k="bump" onclick={bump}>bump</button>
