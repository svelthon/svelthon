<script>
    // The same action in Svelte's own component.
    import { noted } from './action_log.js';

    let count = $state(0);
</script>

<div use:noted={Math.floor(count / 2)}></div>
<button onclick={() => count++}>bump</button>
