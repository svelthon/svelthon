<script>
    import { onMount, onDestroy, untrack } from 'svelte';

    let props = $props();
    const { notify, mode = 'functions', enabled = true } = untrack(() => props);

    notify('init');
    if (mode === 'functions') onMount(() => notify('mount'));
    if (enabled) {
        onDestroy(() => {
            notify('destroy');
            if (mode === 'raising') throw new Error('destroy failed');
        });
    }
</script>

<p>hello</p>
