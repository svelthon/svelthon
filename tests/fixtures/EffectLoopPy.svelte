<script lang="python">
# The same effect in Python: `append` reads `history` as `push` does.
count = 0
history = []


@effect
def journal():
    history.append(count)
</script>

<output class="history">{len(history)}</output>
