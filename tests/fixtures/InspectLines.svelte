<script lang="python">
# `inspect(…)` laid out over several lines, as a formatter writes a long call:
# the same rune as on one line.
count = 0
message = "hello"

inspect(
    count,  # the value
    message,
)


def bump():
    global count
    count += 1
</script>

<p data-k="count">{count}</p>
<button onclick={bump}>bump</button>
