<script lang="python">
notify: object
mode: str = "functions"
enabled: bool = True

notify("init")

if mode == "functions":
    def on_mount():
        notify("mount")

if enabled:
    if mode == "assigned":
        on_destroy = lambda: notify("destroy")
    elif mode == "raising":
        def on_destroy():
            notify("destroy")
            raise ValueError("destroy failed")
    else:
        def on_destroy():
            notify("destroy")
</script>

<p>hello</p>
