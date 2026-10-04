<script>
    // The same parent written in Svelte, the witness for `SpreadConfig`.
    import SpreadConfigChild from './SpreadConfigChild.svelte';

    let config = $state({ rate: 0.25 });
    let attrs = $state({ config, scalar: 0.25 });
    const choices = [{ id: 0.25 }, { id: 0.5 }];
    let chosen = $state.raw(choices[0]);

    export function change() {
        config.rate = 0.5;
        attrs.scalar = 0.5;
        chosen = choices[1];
    }
</script>

<SpreadConfigChild label="direct" config={config} scalar={attrs.scalar} />
<SpreadConfigChild label="spread" {...attrs} />
<select bind:value={chosen}>
    {#each choices as one}<option {...{ value: one }}>{one.id}</option>{/each}
</select>
