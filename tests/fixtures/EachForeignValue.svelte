<script lang="python">
# A JavaScript value a parent hands over, walked by {#each}, and by the
# script's `for`, which is Python's.
data: object = None
scripted = " ".join(str(one) for one in data)
</script>

<p class="each">{#each data as one}<i>{str(one)}</i>{/each}</p>
<p class="script">{scripted}</p>
