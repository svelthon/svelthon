<script>
    // The candidate mechanism, written by hand in JavaScript: two signals per
    // name — the value, and a revision counter the *reader* consults. Mutating
    // in place only increments the counter, with no copy and no reassignment.
    let items = $state.raw([1, 2]);
    let revision = $state.raw(0);

    // What the namespace accessor would do.
    const read = () => {
        revision;
        return items;
    };

    const total = $derived.by(() => read().reduce((a, b) => a + b, 0));

    // The hard case: a derived that returns *the same object*.
    const same = $derived.by(() => read());

    function mutate() {
        items.push(items.length + 1);
        revision += 1;
    }

    function silently() {
        items.push(99); // without touching the counter: the control
    }
</script>

<ul data-k="each">{#each read() as x}<li>{x}</li>{/each}</ul>
<ul data-k="derived">{#each same as x}<li>{x}</li>{/each}</ul>
<output data-k="len">{read().length}</output>
<output data-k="total">{total}</output>

<button data-k="mutate" onclick={mutate}>mutate</button>
<button data-k="silently" onclick={silently}>silently</button>
