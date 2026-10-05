<!--
    Markup above the script, so the script's lines are not the file's: the
    `raise` below is line 13 of this file and line 5 of the Python. A callback
    a library keeps has to be placed in the file all the same.
-->
<p>ready</p>

<script lang="python">
importjs {keep} from './kept_callback.js'


def fail():
    raise ValueError("kept callback failure")


keep(fail)


@export
def direct():
    return fail()
</script>
