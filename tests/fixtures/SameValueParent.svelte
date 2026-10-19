<script>
    let { child: Child, tick } = $props();
    let level = $state(1.5);

    export const change = () => {
        level = 2.5;
    };
</script>

<Child kind="bindable" {tick} bind:level />
