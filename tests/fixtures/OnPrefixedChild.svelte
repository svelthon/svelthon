<script>
    // A JavaScript child, on purpose: this is where the difference shows. A
    // Python child would read the None object back as None and see nothing
    // wrong, and a DOM element never receives an `on*` attribute at all, since
    // Svelte turns it into an event listener. A JS component is the one consumer
    // that is handed the value as it stands.
    let { once, only, onboarding } = $props();

    const shown = (value) => (value === undefined ? 'undefined' : typeof value);
</script>

<p data-k="once">{shown(once)}</p>
<p data-k="only">{shown(only)}</p>
<p data-k="onboarding">{shown(onboarding)}</p>
