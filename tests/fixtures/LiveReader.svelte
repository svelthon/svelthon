<script>
    // A JavaScript child reading what its owner holds, given as props and
    // through a context, and writing to it in place.
    import { getContext } from 'svelte';

    let { state = $bindable(), rows = $bindable(), onpick } = $props();

    const shared = getContext('shared');
</script>

<p data-k="child">{state.count}|{state.rate.toFixed(2)}|{state.inner.n}|{rows.join(',')}|{shared.count}|{state.none === null}</p>
<p data-k="shape">{JSON.stringify(state)}|{Object.keys(state).join(',')}|{Array.isArray(rows)}|{#each rows as row}[{row}]{/each}</p>
<button data-k="push" onclick={() => rows.push(9)}>push</button>
<button data-k="set" onclick={() => (state.count = 10)}>set</button>
<button data-k="pick" onclick={() => onpick?.(state)}>pick</button>
