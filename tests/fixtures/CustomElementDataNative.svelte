<script>
    // CustomElementData in Svelte.
    import './custom_probe.js';

    let data = ['a', 'b'];
    let empty = [];
    let attrs = { open: ['c'] };
</script>

<svelthon-probe data-k="named" open={data}></svelthon-probe>
<svelthon-probe data-k="empty" open={empty}></svelthon-probe>
<svelthon-probe data-k="disabled" disabled={data}></svelthon-probe>
<svelthon-probe data-k="spread" {...attrs}></svelthon-probe>
<details data-k="standard" open={empty}></details>
