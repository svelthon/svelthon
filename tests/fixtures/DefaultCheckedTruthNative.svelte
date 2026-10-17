<script>
    // The witness for DefaultCheckedTruth: the same boxes in Svelte, given the
    // truth Python finds.
    let { full = false } = $props();

    const initial = () => full;

    let selected = $state(undefined);
    let value = $state(initial());

    export function model() {
        return selected;
    }
</script>

<form>
    <input type="checkbox" data-k="direct" defaultChecked={value} />
    <input type="checkbox" data-k="quoted" defaultChecked="{value}" />
    <input type="checkbox" data-k="spread" {...{ defaultChecked: value }} />
    <input type="checkbox" data-k="bound" defaultChecked={value} bind:checked={selected} />
</form>
