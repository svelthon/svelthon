<script>
    // The parent of a child given as a prop, passing it `amount` and letting a
    // test change what it passes, or pass nothing.
    let { child: Child } = $props();
    let amount = $state(0.25);
    let ref;

    export function give(value) {
        amount = value;
    }

    export function own() {
        ref.own();
    }

    export function model() {
        return ref.model();
    }
</script>

<Child bind:this={ref} {amount} />
