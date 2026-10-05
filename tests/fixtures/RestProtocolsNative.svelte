<script>
    // The witness of `RestProtocols.svelte` for the JavaScript rows.
    import { rows } from './rest_protocols.js';

    const pairs = [
        ['refusing', rows.refusing],
        ['counting', rows.counting]
    ];
</script>

{#each pairs as [kind, row]}
    {#each [row] as { first: selected, ...rest }}
        <p data-k={kind}>{selected}|{Object.keys(rest).sort().join(',')}</p>
    {/each}
{/each}
