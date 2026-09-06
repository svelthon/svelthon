<script module>
    import Taker from './SnippetTaker.svelte';
</script>

<script lang="python">
# A snippet handed to a child by its name, in every shape that reaches for it.
tags = ["x", "y"]
pick = True
</script>

<!-- Above its own declaration: Svelte hoists a snippet within its scope. -->
<p data-k="hoisted"><Taker {row} /></p>

{#snippet row(what)}<b>row {what}</b>{/snippet}

{#snippet other(what)}<b>other {what}</b>{/snippet}

<p data-k="named"><Taker {row} /></p>
<p data-k="renamed"><Taker header={row} /></p>
<p data-k="twice"><Taker {row} /><Taker {row} /></p>
<p data-k="chosen"><Taker row={row if pick else other} /></p>

<!-- Declared inside a block, used inside it, and closing over the block's own
     name: the two scopes have to hold at once. -->
{#each tags as tag}
    {#snippet cell(what)}<i>{tag}{what}</i>{/snippet}
    <p data-k="cell"><Taker row={cell} /></p>
{/each}
