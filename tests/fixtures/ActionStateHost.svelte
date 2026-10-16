<script>
    // The parent of ActionState and of its Svelte twin: a state of its own,
    // handed down and changed in place.
    let { Child, observe, report, python_action } = $props();
    let model = $state({ n: 1 });
    let child;

    export function bump() {
        model.n += 1;
    }

    export function local() {
        child.bump_local();
    }
</script>

<Child {model} {observe} {report} {python_action} bind:this={child} />
