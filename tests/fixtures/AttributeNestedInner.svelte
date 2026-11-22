<script lang="python">
class Caption:
    def __str__(self):
        raise ValueError("inner caption was overridden")


old = Caption()
chosen = {"title": "Chosen"}
</script>

<p title={old} {**chosen}>Inner</p>
