<script lang="python">
# Callables handed to `inspect_with` in parentheses that group them, which
# change nothing in Python: each logs as the bare one does. They record outside
# the component, since Svelte forbids writing to state from inside `$inspect`.
count = 0


def record(kind, *values):
    js.globalThis.__grouped.push(f"{kind}:{values[0]}")


class Sink:
    def record(self, kind, *values):
        record(kind, *values)

    def __call__(self, kind, *values):
        record(kind, *values)


sink = Sink()
callbacks = [record]


def factory():
    return record


inspect_with((record), count)
inspect_with(((record)), count)
inspect_with((sink.record), count)
inspect_with((sink), count)
inspect_with((factory()), count)
inspect_with((lambda kind, *values: record(kind, *values)), count)
inspect_with((record if True else sink.record), count)
inspect_with((callbacks[0]), count)
inspect_with(
    (
        record
    ),
    count
)


@export
def bump():
    global count
    count += 1
</script>

<p>{count}</p>
