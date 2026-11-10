<script>
    // Svelte's witness for PlainModuleCache.svelte.
    import * as plain_cache from './plain_cache.js';

    let n = $state(2);
    let d = $derived(plain_cache.double(n));
</script>

<button data-k="go" onclick={() => n++}>go</button>
<button data-k="forget" onclick={() => plain_cache.forget()}>forget</button>
<p data-k="view">{plain_cache.double(n)}|{d}|{Object.keys(plain_cache.seen).length}</p>
