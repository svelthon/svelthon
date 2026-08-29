<script lang="python">
count = 0
message = "hello"

inspect(count, message)


def bump():
    global count
    count += 1
</script>

<p data-k="count">{count}</p>
<button onclick={bump}>bump</button>
