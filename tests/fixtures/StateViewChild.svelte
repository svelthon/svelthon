<script>
    import { untrack } from 'svelte';

    let { given, point } = $props();
    let local = $state(untrack(() => given));
    let mine = $state(untrack(() => point));
</script>

<button data-k="js" onclick={() => { local.count = 5; mine.x = 5; }}>js</button>
<p data-k="javascript">{local.count}|{mine.x}</p>
