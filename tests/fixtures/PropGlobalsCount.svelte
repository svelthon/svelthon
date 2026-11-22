<script lang="python">
# A module that counts its names, or hands its namespace on, writes no prop:
# its doors read and never write.
label: str
revision: int


def count(names):
    return len(names)


size = len(globals())
handed = count(globals())
</script>

<p>{revision}|{label}</p>
