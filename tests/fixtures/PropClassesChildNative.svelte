<script>
    // PropClassesChild in Svelte: its reads of the names read the prop once.
    const VALUES = { half: 0.5, other: 0.75 };
    let { value = 'default' } = $props();

    export function own(kind) {
        value = VALUES[kind];
    }

    export function peek() {
        void value;
    }

    export function model() {
        return `float ${value}`;
    }
</script>

<p>{`float ${value}`}</p>
