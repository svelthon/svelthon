<script lang="python">
    # Rebinds a name of its own to a shared list as it goes, in its cleanup.
    shared: object = None

    rows = []


    def on_destroy():
        global rows
        rows = shared
</script>

<p>{len(rows)}</p>
