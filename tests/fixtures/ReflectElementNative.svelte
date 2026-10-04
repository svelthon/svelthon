<svelte:options customElement={{
    tag: 'reflect-element-native',
    shadow: 'none',
    props: { level: { type: 'Number', reflect: true } },
}} />

<script>
// The same element in Svelte's own language.
let { level = 1 } = $props();

function step() {
    level += 0.5;
}
</script>

<button data-k="step" onclick={step}>step</button>
