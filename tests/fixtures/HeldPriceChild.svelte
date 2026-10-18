<script lang="python">
    # A Python child that reads what its prop is: a `Price` of its parent's
    # keeps its class and its `currency`.
    value: object
</script>

<output>{type(value).__name__}|{value.currency}</output>
