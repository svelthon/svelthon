<script lang="python">
short: bool = False
log: object = None

if short:
    def on_mount():
        log("mount short")
else:
    def on_mount():
        log("mount long")

    def on_destroy():
        log("destroy long")
</script>

<p>{short}</p>
