<script>
    // A parent whose setter decides what the bound prop holds: the child's
    // value refused, normalized to 3, or accepted.
    let { Child, kind = 'array', mode = 'reject' } = $props();

    const initial = () => (kind === 'array' ? [1] : kind === 'object' ? { n: 1 } : 1);

    let value = $state.raw(initial());
    let child;

    function write(next) {
        if (mode === 'accept') value = next;
        else if (mode === 'normalize') value = kind === 'array' ? [3] : kind === 'object' ? { n: 3 } : 3;
    }

    const shown = () => (kind === 'array' ? value[0] : kind === 'object' ? value.n : value);

    export function change() {
        child.change();
    }

    export function read() {
        return { parent: shown(), child: child.read() };
    }
</script>

<Child {kind} bind:value={() => value, write} bind:this={child} />
<p data-k="parent">{shown()}</p>
