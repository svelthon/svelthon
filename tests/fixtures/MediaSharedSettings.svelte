<script lang="python">
# Three settings of a player bound to members of one dict and of one instance,
# which a controller sets together; Chromium hands back each change by an event
# of its own, later. The witness is `MediaSharedSettingsNative.svelte`, and the
# page that compares them `media.html`.
class Settings:
    def __init__(self):
        self.volume = 0.25
        self.rate = 1.25
        self.muted = False


row = {"volume": 0.25, "rate": 1.25, "muted": False}
held = Settings()
</script>

<audio data-k="dict" bind:volume={row["volume"]} bind:playbackRate={row["rate"]} bind:muted={row["muted"]}></audio>
<audio data-k="instance" bind:volume={held.volume} bind:playbackRate={held.rate} bind:muted={held.muted}></audio>
<p data-k="model">{row["volume"]} {row["rate"]} {"muted" if row["muted"] else "loud"} {held.volume} {held.rate} {"muted" if held.muted else "loud"}</p>
