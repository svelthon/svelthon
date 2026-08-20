<script lang="python">
notify: object = None

started = "no"
mounts = 0
ticks = 0

def on_mount():
    global started, mounts
    started = "yes"
    mounts += 1

def tick():
    global ticks
    ticks += 1

def on_destroy():
    if notify is not None:
        notify(f"destroyed after {ticks} tick(s)")
</script>

<p data-k="started">{started}</p>
<p data-k="ticks">{ticks}</p>
<p data-k="mounts">{mounts}</p>
<button data-k="tick" onclick={tick}>tick</button>
