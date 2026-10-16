<script>
    // BindableDecision in Svelte.
    let { value = $bindable(), kind = 'array' } = $props();

    export function change() {
        value = kind === 'array' ? [2] : kind === 'object' ? { n: 2 } : 2;
    }

    export function read() {
        return kind === 'array' ? value[0] : kind === 'object' ? value.n : value;
    }
</script>

<p data-k="child">{kind === 'array' ? value[0] : kind === 'object' ? value.n : value}</p>
