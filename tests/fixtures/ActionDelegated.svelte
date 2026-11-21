<script lang="python">
# A JavaScript action a Python function installs and returns, as a wrapper
# that does more at the install: its `update` is JavaScript's.
importjs {typed} from "./action_log.js"

value = 1.25


def observe(node, given):
    return typed(node, given)


@export
def bump():
    global value
    value = value + 0.5
</script>

<div use:observe={value}></div>
<p use:observe={[value]}></p>
