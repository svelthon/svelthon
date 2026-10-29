<script lang="python">
# A Python component that renders no component, and hands its parent a
# function reading one of its globals.
publish: object
count = 7


def value():
    return count


publish(value)
</script>

<output>{count}</output>
