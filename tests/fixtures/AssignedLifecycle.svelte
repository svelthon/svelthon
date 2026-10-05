<script lang="python">
# Hooks bound by `=` rather than by `def`: the value the name holds once the
# script has run is the hook, whichever statement bound it.
log: object = None

on_mount = lambda: (log("mount"), lambda: log("cleanup"))[1]
on_destroy = lambda: log("destroy")
</script>

<p>assigned</p>
