<script lang="python">
# An instance JavaScript deletes `value` of through its view, and what the
# component shows of it.
from deleted_attributes import fresh, describe
kind: str = "property"
box = fresh(kind)


@export
def expose():
    return box
</script>

<output>{describe(box)}</output>
