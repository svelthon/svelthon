<script lang="python" generics="T extends Map<string, number>
    | null">
# The body starts past the tag's own `>`, a line below the quoted one.
@export
def fail():
    raise ValueError("boom")
</script>
