<script>
    // The same child written in Svelte, the witness for `PropOverrideChild`.
    let { amount = 0.25 } = $props();

    export function own() {
        amount = 0.5;
    }

    export function model() {
        return String(amount);
    }
</script>

<p>{amount}</p>
