<svelte:options customElement={{
    tag: 'partial-props-element-native',
    shadow: 'none',
    props: {
        middle: { type: 'Number', reflect: true },
        extra: { type: 'String' },
    },
}} />

<script>
// The same element in Svelte's own language.
let { first = 'a', middle = 1, last = 'z' } = $props();
</script>

<p>{first}|{middle}|{last}</p>
