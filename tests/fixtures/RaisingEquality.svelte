<script lang="python">
# An `__eq__` of the author's that raises. Deciding which member of a group is
# selected asks Python's `==`, so the failure belongs to the author and has to
# reach them — answering "not equal" would be plausible and wrong.
class Token:
    def __eq__(self, other):
        raise ValueError("comparison failed")


selected = Token()
option = Token()
</script>

<input data-k="radio" type="radio" bind:group={selected} value={option} />
