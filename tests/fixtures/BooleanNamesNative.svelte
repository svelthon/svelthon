<script>
    // The witness of `BooleanNames.svelte`: Svelte given the truth Python finds.
    let { on = false } = $props();
</script>

<input type="checkbox" indeterminate={on} />
<input type="file" webkitdirectory={on} />
<video disablepictureinpicture={on} disableremoteplayback={on}></video>
<input type="file" {...{ webkitdirectory: on }} />
<video {...{ disablepictureinpicture: on, disableremoteplayback: on }}></video>
