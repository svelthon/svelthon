<script lang="python">
# A function that counts its own names writes no prop: `locals()` there is the
# function's, not the module's.
label: str
revision: int


def local_count():
    local = 42
    return len(locals())


scope_size = local_count()
</script>

<p>{revision}|{label}</p>
