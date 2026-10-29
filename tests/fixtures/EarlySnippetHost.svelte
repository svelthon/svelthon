<script>
// Hands a Python component a snippet whose JavaScript child's cleanup reads
// what the Python component passed it.
import Parent from './EarlySnippetParent.svelte';
import Child from './EarlyJsChild.svelte';

let { capture } = $props();
</script>

<Parent {capture}>
    {#snippet children(n, record)}
        <Child {n} capture={record} />
    {/snippet}
</Parent>
