<script>
    // Svelte's witness for MediaSharedSettings.svelte.
    class Settings {
        volume = $state(0.25);
        rate = $state(1.25);
        muted = $state(false);
    }

    let row = $state({ volume: 0.25, rate: 1.25, muted: false });
    const held = new Settings();
</script>

<audio data-k="dict" bind:volume={row.volume} bind:playbackRate={row.rate} bind:muted={row.muted}></audio>
<audio data-k="instance" bind:volume={held.volume} bind:playbackRate={held.rate} bind:muted={held.muted}></audio>
<p data-k="model">{row.volume} {row.rate} {row.muted ? 'muted' : 'loud'} {held.volume} {held.rate} {held.muted ? 'muted' : 'loud'}</p>
