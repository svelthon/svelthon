<script lang="python">
# A name the template reads and only `globals()` binds, in the module's body and
# in a function, beside one a statement binds; and one the template reads only
# once a function has written it.
known = 1
globals()["dynamic"] = 6
shown = False


@export
def write():
    global shown
    globals()["known"] = 2
    globals()["dynamic"] = 60
    globals()["later"] = 7
    shown = True
</script>

<p data-k="view">{known}|{dynamic}|{#if shown}{later}{/if}|{len([known])}</p>
