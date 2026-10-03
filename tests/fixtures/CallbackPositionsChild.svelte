<script>
    import { untrack } from 'svelte';

    // A JavaScript child reading every position a parent can hand one Python
    // callback through, and what it answers. Read once, as they arrived, which
    // `untrack` says to Svelte.
    let { direct, again, config, onpick, spread, onchange, registry } = $props();

    const positions = untrack(() => ({ direct, again, nested: config.cb, onpick, spread }));
    const same = Object.values(positions).every((one) => one === positions.direct);
    const removed = untrack(() => registry.delete(config.cb));
</script>

<p data-k="same">{String(same)}</p>
<p data-k="removed">{String(removed)}</p>
<p data-k="answer">{typeof onpick(0.5)}:{onpick(0.5)}</p>
<button data-k="change" onclick={() => onchange(7)}>change</button>
