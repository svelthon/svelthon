<script>
    // The same reads and writes on Svelte's own map and set.
    import { untrack } from 'svelte';
    import { SvelteMap, SvelteSet } from 'svelte/reactivity';
    import { watch, start } from './enumerated.js';

    let { kind = 'get', n = 50 } = $props();
    const table = new SvelteMap(untrack(() => Array.from({ length: n }, (_, i) => [String(i), i])));
    const numbers = new SvelteMap(untrack(() => Array.from({ length: n }, (_, i) => [i, i])));
    const members = new SvelteSet(untrack(() => Array.from({ length: n }, (_, i) => i)));
    untrack(() => watch(kind === 'add' ? members : kind === 'setdefault' || kind === 'same value' ? numbers : table));

    function total() {
        start();
        let result = 0;
        for (let i = 0; i < n; i++) {
            if (kind === 'get') result += table.get(String(i));
            else if (kind === 'setdefault') {
                if (!numbers.has(i)) numbers.set(i, 0);
                result += numbers.get(i);
            } else if (kind === 'same value') {
                numbers.set(i, numbers.get(i));
                result += numbers.get(i);
            } else {
                members.add(i);
                result += i;
            }
        }
        return result;
    }
</script>

<output>{total()}</output>
