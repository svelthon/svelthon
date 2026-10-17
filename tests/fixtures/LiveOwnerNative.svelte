<script>
    // The same owner in Svelte: the witness for LiveOwner.
    import { setContext } from 'svelte';
    import LiveReader from './LiveReader.svelte';

    let state = $state({ count: 0, rate: 0.5, inner: { n: 0 }, none: undefined });
    let rows = $state([1, 2]);
    let shared = $state({ count: 0 });

    setContext('shared', shared);

    export function bump() {
        state.count += 1;
    }

    export function share() {
        shared.count += 1;
    }

    export function add() {
        rows.push(3);
    }

    export function nest() {
        state.inner.n += 1;
    }
</script>

<p data-k="owner">{state.count}|{state.rate}|{state.inner.n}|{rows.join(',')}|{shared.count}</p>
<LiveReader bind:state bind:rows />
