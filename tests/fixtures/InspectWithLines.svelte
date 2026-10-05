<script lang="python">
# `inspect_with` as a formatter lays it out, the logger on a line of its own.
count = 0


def log(kind, *values):
    js.inspectWithLines.push(f"{kind} {values[0]}")


inspect_with(
    log,
    count,
)


def bump():
    global count
    count += 1
</script>

<button onclick={bump}>bump</button>
