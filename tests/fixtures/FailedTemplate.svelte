<script lang="python">
    # Reads a shared list into a name of its own, then fails in its template.
    shared: object = None

    rows = shared
</script>

<p>{len(rows)} {1 / 0}</p>
