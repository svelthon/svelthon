<script lang="python">
# A Python child handed the same dict, as a prop and through a context.
state: object = None
</script>

<p data-k="python">{type(state).__name__}:{state is get_context("whole")}</p>
