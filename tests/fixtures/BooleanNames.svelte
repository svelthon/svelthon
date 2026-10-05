<script lang="python">
# The boolean attributes the table had left out, given an empty list and a
# full one, written directly and spread.
on: bool = False

picked = [1] if on else []
</script>

<input type="checkbox" indeterminate={picked} />
<input type="file" webkitdirectory={picked} />
<video disablepictureinpicture={picked} disableremoteplayback={picked}></video>
<input type="file" {**{"webkitdirectory": picked}} />
<video {**{"disablepictureinpicture": picked, "disableremoteplayback": picked}}></video>
