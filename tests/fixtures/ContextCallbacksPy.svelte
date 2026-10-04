<script lang="python">
# A Python child reading what a Python parent shared: the callables it set,
# with their attributes and their Python answers.
shared = get_context("instance")
called = [
    get_context("zero")(),
    get_context("formatted")(0.25),
    type(get_context("bound")(0.25)).__name__,
    shared.factor,
]
</script>

<p data-k="python-calls">{called}</p>
