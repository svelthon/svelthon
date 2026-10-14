<script>
    // The same snippet in Svelte, None its `undefined`: the witness for
    // SnippetSelects.
    let { first = 'multiple' } = $props();

    const original = [undefined];
    const many = { multiple: true };
    const one = { multiple: false };

    let picked = $state.raw(original);

    export function model() {
        return [Array.isArray(picked) ? 'list' : typeof picked, picked === original];
    }
</script>

{#snippet choice(attrs, k)}
    <select data-k={k} {...attrs} bind:value={picked}>
        {#if k === 'multiple'}<option value={undefined}>none</option><option value={0.5}>half</option>
        {:else}<option value={original}>list</option><option value={undefined}>none</option>{/if}
    </select>
{/snippet}

{#if first === 'multiple'}{@render choice(many, 'multiple')}{@render choice(one, 'single')}
{:else}{@render choice(one, 'single')}{@render choice(many, 'multiple')}{/if}
