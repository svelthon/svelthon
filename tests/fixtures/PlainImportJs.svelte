<script>
    // The same child in Svelte.
    import { plain } from './plain_object.js';

    let { count } = $props();
</script>

<p data-x={plain.name}>{plain.name}|{count}</p>
<b>{plain.name + '!'}</b>
<svelte:boundary><i>{plain.name}|{count}</i></svelte:boundary>
