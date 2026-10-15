<script>
    // The same in Svelte: a row made at each call, keyed by itself, and a row
    // keyed by its position.
    let step = $state(0);
    let row = $state({ text: 'same' });

    function rows() {
        const unused = step;
        return [[row]];
    }

    export function advance() {
        step++;
    }
</script>

<div data-k="made">{#each rows() as pair (pair)}<input value="draft" />{/each}</div>
<div data-k="paired">{#each [row].entries() as [at, one] (at)}<input value="draft" />{/each}</div>
