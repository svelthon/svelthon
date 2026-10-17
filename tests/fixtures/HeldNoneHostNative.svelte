<script>
    // HeldNoneHost.svelte in Svelte, handing `undefined`.
    import Native from './HeldNoneChild.svelte';

    const Pick = Native;
    let value = $state(undefined);
</script>

<Native {value} bind:bound={value} label="direct" />
<Pick {value} bind:bound={value} label="named" />
<Pick {...{ value, label: 'spread' }} />
<Pick {value} label="component" />
