<script>
    // The witness of `ComputedRest.svelte`.
    import { key } from './computed_rest_keys.js';

    let rows = [{ first: 1, second: 2, third: 3 }];
</script>

{#each rows as { [key()]: selected, ...rest }}
    <p data-k="selected">{selected}</p>
    <p data-k="rest">{Object.keys(rest).join(',')}</p>
{/each}
