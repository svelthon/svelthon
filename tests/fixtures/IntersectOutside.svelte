<script lang="python">
# A set the page reads, kept whole by an intersection_update made while
# rendering when asked to, and outside rendering by the test.
from intersect_outside import flags, keep_all

during: bool = False
</script>

<p>{len(flags)}</p>
<output>{keep_all() if during else ""}</output>
