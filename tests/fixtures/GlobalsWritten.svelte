<script lang="python">
# A name the template reads and only `globals()` binds, in the module's body and
# in a function, beside one a statement binds; and one nothing has bound yet.
known = 1
globals()["dynamic"] = 6


@export
def write():
    globals()["known"] = 2
    globals()["dynamic"] = 60
    globals()["later"] = 7
</script>

<p data-k="view">{known}|{dynamic}|{later}|{len([known])}</p>
