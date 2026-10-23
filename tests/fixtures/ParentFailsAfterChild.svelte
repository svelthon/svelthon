<script>
    // A Python child rendered whole, then its parent fails: the render never
    // closes, the child's script included.
    let { Child, shared } = $props();

    const fail = () => {
        throw new Error('the parent fails');
    };
</script>

<Child {shared} />
<p>{fail()}</p>
