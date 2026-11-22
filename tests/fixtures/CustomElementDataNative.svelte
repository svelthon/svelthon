<script>
    // CustomElementData in Svelte.
    import './custom_probe.js';

    let data = ['a', 'b'];
    let empty = [];
    let attrs = { open: ['c'], hidden: ['d'] };
    let tag = 'svelthon-probe';
    let hidden = ['e'];
    let payload = ['f'];
    let standard = 'details';
    let switched = $state('details');
</script>

<svelthon-probe data-k="named" open={data}></svelthon-probe>
<svelthon-probe data-k="empty" open={empty}></svelthon-probe>
<svelthon-probe data-k="disabled" disabled={data}></svelthon-probe>
<svelthon-probe data-k="spread" {...attrs}></svelthon-probe>
<svelthon-probe data-k="hidden" hidden={data}></svelthon-probe>
<details data-k="standard" open={empty}></details>
<svelte:element this={tag} data-k="dynamic" open={data} hidden={data}></svelte:element>
<svelte:element this={tag} data-k="shorthand" {hidden}></svelte:element>
<svelte:element this={tag} data-k="dynamicSpread" {...attrs}></svelte:element>
<svelte:element this={standard} data-k="dynamicStandard" open={empty}></svelte:element>
<svelte:element this={switched} data-k="switched" open={data} payload={data} />
<svelte:element this={tag} data-k="payload" payload={data}></svelte:element>
<svelte:element this={tag} data-k="payloadShorthand" {payload}></svelte:element>
<svelte:element this={tag} data-k="payloadQuoted" payload="{data}"></svelte:element>
<button data-k="switch" onclick={() => (switched = switched === 'details' ? 'svelthon-probe' : 'details')}>switch</button>
