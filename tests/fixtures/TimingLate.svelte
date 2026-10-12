<script lang="python">
# Two reactive modules imported for the first time while the page reads.
@derived
def answer():
    import timing_late_derived
    return timing_late_derived.count


def read():
    import timing_late_read
    return timing_late_read.count


@export
def bump():
    import timing_late_derived
    import timing_late_read
    timing_late_derived.count += 1
    timing_late_read.count += 1
</script>

<output>{answer} {read()}</output>
