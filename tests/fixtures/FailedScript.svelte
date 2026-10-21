<script lang="python">
    # Reads a shared list into a name of its own, then fails in its script.
    shared: object = None

    rows = shared
    raise ValueError("the script fails")
</script>

<p>{len(rows)}</p>
