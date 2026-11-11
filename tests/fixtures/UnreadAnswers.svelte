<script module>
import { record } from './lifecycle_log.js';
</script>
<script lang="python">
# What Svelte does not read is left unread: a generator a cleanup, a hook, an
# action's `update` and `destroy` or a transition's `tick` answers is never
# walked.
count = 0


def lazy(name):
    record(f"walk {name}")
    yield 42


def answering(name):
    def answer(*args):
        record(name)
        return lazy(name)

    return answer


@effect
def installed():
    return answering("effect cleanup")


def attached(node):
    return answering("attach cleanup")


def on_mount():
    return answering("mount cleanup")


on_destroy = answering("destroy")


def act(node, value):
    return {"update": answering("update"), "destroy": answering("action destroy")}


def appear(node, params):
    return {"duration": 10, "tick": answering("tick")}


def bump():
    global count
    count += 1
</script>

<button use:act={count} {@attach attached} in:appear onclick={bump}>{count}</button>
