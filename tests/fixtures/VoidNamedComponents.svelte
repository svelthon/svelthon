<script module>
    import Input from './TitledCard.svelte';
    import Link from './TitledCard.svelte';
</script>

<script lang="python">
# A component named like a void element has a body: its closing tag closes its
# own scope, and the loop's name is still there after it.
rows = [1, 2]
</script>

{#each rows as row}
    <Input title="i"><p>{row}</p></Input>
    <Link title="l"><p>{row}</p></Link>
    <p class="after">{row}</p>
{/each}
