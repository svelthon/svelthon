<script lang="python">
from server_rows import rows

token: object

@effect.root
def watch():
    len(rows)
</script>

<p>{len(rows)}</p>
