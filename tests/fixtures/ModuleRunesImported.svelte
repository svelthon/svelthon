<script module>
    // A rune name imported by name, and one imported under another.
    import { derived, writable as props } from 'svelte/store';
    export const doubled = derived(props(2), (value) => value * 2);
    export { derived };
</script>

<script lang="python">
name = "x"
</script>

<p>{name}</p>
