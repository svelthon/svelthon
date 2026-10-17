<script lang="python">
# A refusal of the crossing's, two keys JavaScript cannot tell apart, caught
# by Python in an `except`, a path no wrapper of the component sees.
clash = {1: "a", "1": "b"}


@export
def caught():
    try:
        to_js(clash)
    except Exception as error:
        return str(error)
    return "no refusal"
</script>

<p>{len(clash)}</p>
