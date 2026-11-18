<script>
    // The same in Svelte.
    let { record, count, tally } = $props();
    let attrs = $state({ title: 't1' });
    let nested = $state({ class: ['a'] });
    let items = $state([]);
    let tag = 'p';

    function bump() {
        attrs.title = 't2';
        nested.class.push('b');
        items.push(1);
    }

    function make() {
        tally();
        return { title: 'm' };
    }
</script>

<button data-k="go" onclick={bump}>go</button>
<svelte:element this={tag} data-k="named" {...attrs}>x</svelte:element>
<svelte:element this={'p'} data-k="written" {...attrs}>x</svelte:element>
<p data-k="plain" {...attrs}>x</p>
<svelte:element this={tag} data-k="nested" {...nested}>x</svelte:element>
<svelte:element this={tag} data-k="record" {...record} data-c={count}>x</svelte:element>
{#if count >= 0}<svelte:element this={tag} data-k="block" {...attrs}>x</svelte:element>{/if}
<svelte:element this={tag} data-k="made" {...make()} data-c={count}>x</svelte:element>
<svelte:element this={tag} data-k="locked" hidden={record.locked} data-c={count}>x</svelte:element>
<svelte:element this={tag} data-k="filled" hidden={items.length > 0}>x</svelte:element>
