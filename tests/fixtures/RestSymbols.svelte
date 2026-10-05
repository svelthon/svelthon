<script lang="python">
# The rest of a JavaScript row keeps its enumerable symbols, as JavaScript's
# own rest does, and a symbol taken by a computed key is left out of it.
importjs {rows, token} from './rest_symbols.js'
</script>

{#each rows as {first: selected, **rest}}
    <p data-k="kept">{selected}|{len(rest)}|{rest[token]}</p>
{/each}
{#each rows as {[token]: selected, **rest}}
    <p data-k="taken">{selected}|{len(rest)}</p>
{/each}
