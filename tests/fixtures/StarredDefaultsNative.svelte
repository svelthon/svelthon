<script>
    // Svelte's witness for StarredDefaults.svelte.
    import { makeRow, later } from './starred_defaults.js';

    const rows = [makeRow('undefined'), makeRow('hole'), makeRow('null'), [null, 'tail'], makeRow('value')];
    const pending = later('undefined');
</script>

{#each rows as [value = 'fallback', ...rest]}<p data-k="each">{JSON.stringify([value, rest])}</p>{/each}
{#snippet shown([value = 'fallback', ...rest])}<p data-k="snippet">{JSON.stringify([value, rest])}</p>{/snippet}
{#each rows as row}{@render shown(row)}{/each}
{#await pending then [value = 'fallback', ...rest]}<p data-k="then">{JSON.stringify([value, rest])}</p>{/await}
