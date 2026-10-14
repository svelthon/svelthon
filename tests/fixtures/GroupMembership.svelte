<script lang="python">
# A selection whose class answers `in` for itself: by a rule of its own, always
# or never; and a plain list beside them. The box shows what `in` says.
rule: str = "fold"


class Selection(list):
    def __contains__(self, value):
        if rule == "always":
            return True
        if rule == "never":
            return False
        return any(str(one).lower() == str(value).lower() for one in self)


held = {"fold": ["YES"], "always": [], "never": ["yes"], "plain": ["yes"]}[rule]
picked = held if rule == "plain" else Selection(held)
</script>

<input type="checkbox" value="yes" bind:group={picked} />
