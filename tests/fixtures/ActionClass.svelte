<script lang="python">
# An action handed the parent's state, which holds an instance of a class of
# JavaScript's: a change of its field reaches the action's `update`.
model: object
report: object


def observe(node, value):
    report("install", value.counter.n)

    def update(value):
        report("update", value.counter.n)

    return {"update": update}
</script>

<div use:observe={model}></div>
