<script>
    // A JavaScript child that spreads what it is handed onto its element.
    let { ...rest } = $props();
</script>

<p {...rest}>passed</p>
