<script>
    // The witness of `RestMembers.svelte`.
    import { rows, typed } from './rest_members.js';
</script>

{#each rows as { id, ...rest }}
    <p data-k="rest">{id}|{rest.describe()}</p>
{/each}
<p data-k="dot">{typed.describe()}</p>
