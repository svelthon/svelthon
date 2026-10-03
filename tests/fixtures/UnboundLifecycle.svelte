<script lang="python">
mode: str = "kept"
log: object = None

def on_mount():
    log("mount")

def on_destroy():
    log("destroy")

if mode == "none":
    on_mount = None
elif mode == "deleted":
    del on_mount
    del on_destroy
</script>

<p>{mode}</p>
