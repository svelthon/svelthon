<script>
    // The witness of `RestKeys.svelte` for the rows JavaScript hands over.
    import { years, flags } from './rest_keys.js';

    const year = 2024;
    const keys = (rest) => Object.keys(rest).sort().join(',');
</script>

{#each years as { [year]: value, ...rest }}
    <p data-k="year">{value}|{keys(rest)}</p>
{/each}
{#each flags as { [0]: value, ...rest }}
    <p data-k="int">{value}|{keys(rest)}</p>
{/each}
{#each flags as { ['0']: value, ...rest }}
    <p data-k="str">{value}|{keys(rest)}</p>
{/each}
{#each flags as { [true]: value, ...rest }}
    <p data-k="bool">{value}|{keys(rest)}</p>
{/each}
