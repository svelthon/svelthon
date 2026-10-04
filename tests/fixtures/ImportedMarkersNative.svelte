<script>
    // The same component in JavaScript, the witness.
    import { inspect } from './imported_markers.js';
    import { derived, writable, get } from 'svelte/store';

    let answer = $state(inspect(41));
    inspect(1);
    const base = writable(1);
    const total = derived(base, (value) => value * 2);
    let doubled = $state(get(total));
</script>

<p>{answer}:{doubled}</p>
