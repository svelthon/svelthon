<script>
    // The module's object changed in place, then the children rendered again
    // because the count changed.
    import PlainImportPy from './PlainImportPy.svelte';
    import PlainImportJs from './PlainImportJs.svelte';
    import { rename } from './plain_object.js';

    let count = $state(0);

    export function change() {
        rename();
        count += 1;
    }
</script>

<div data-k="python"><PlainImportPy {count} /></div>
<div data-k="svelte"><PlainImportJs {count} /></div>
