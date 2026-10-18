<script lang="python">
# A method of a JavaScript record, taken by `**rest` or read by the dot, runs
# with the record as `this`, as JavaScript calls it.
importjs {rows, typed} from './rest_members.js'
</script>

{#each rows as {id, **rest}}
    <p data-k="rest">{id}|{rest["describe"]()}</p>
{/each}
<p data-k="dot">{typed.describe()}</p>
