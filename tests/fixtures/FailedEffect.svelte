<script lang="python">
    # Reads a shared list into a name of its own, then fails in an effect.
    shared: object = None

    rows = shared


    @effect
    def fails():
        raise ValueError("the effect fails")
</script>

<p>{len(rows)}</p>
