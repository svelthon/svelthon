<script lang="python">
enabled: bool = False
label: str = ""
log: object = None

if enabled:
    def on_mount():
        log(f"mount {label}")
        return lambda: log("cleanup")

    def on_destroy():
        log("destroy")
</script>

<p data-k="label">{label}</p>
