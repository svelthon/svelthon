<script module>
    import GroupBox from './GroupBox.svelte';
</script>

<script lang="python">
# Two instances of one component, handed the same empty list. The binding text is
# `selected` in both, and the list they start from is one object — so neither the
# expression nor the value tells the two groups apart.
shared = []
</script>

<form data-k="form">
    <GroupBox initial={shared} value="a" />
    <GroupBox initial={shared} value="b" />
</form>
