<script>
    // The witness of `RestSymbols.svelte` for the symbol kept. Not for the one
    // taken by a computed key: Svelte excludes `String(key)`, so a symbol taken
    // stays in its rest, where JavaScript's own rest leaves it out.
    import { rows, token } from './rest_symbols.js';

    const count = (rest) => Reflect.ownKeys(rest).length;
</script>

{#each rows as { first: selected, ...rest }}
    <p data-k="kept">{selected}|{count(rest)}|{rest[token]}</p>
{/each}
