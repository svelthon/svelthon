<script>
    // The same handlers written in Svelte, the witness for `DomHandlers`.
    import * as callbacks from './dom_handlers.js';
    import { receiver } from './dom_handlers.js';

    let { handler } = $props();

    const make = () => undefined;
</script>

<button data-k="named" onclick={receiver}><span>named</span></button>
<button data-k="namespace" onclick={callbacks.receiver}><span>namespace</span></button>
<button data-k="optional" onclick={handler}>optional</button>
<button data-k="called" onclick={make()}>called</button>
