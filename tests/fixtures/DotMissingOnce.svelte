<script lang="python">
# A name `__getattr__` refuses the first time it is asked and answers after,
# on a dict that holds no key of it: read once, it is missing. Counted
# untracked, as a render may not write state.
importjs { untrack } from "svelte"


def count():
    Once.asked += 1


class Once(dict):
    asked = 0

    def __getattr__(self, name):
        if name == "label":
            untrack(count)
            if Once.asked > 1:
                return "second"
        raise AttributeError(name)


record = Once()
</script>

<p data-k="once">{record.label}</p>
