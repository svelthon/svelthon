<script lang="python">
# Each default is the first write on its annotation's line; what follows the
# semicolon is the child's own write, as it is on the next line.
text: str = " d "; text = text.strip().upper()
tally: int = 0; tally += 1
left: str = "d"; right: str = "d"; left = left.upper(); right = right.upper()
twice: str = "d"; twice = twice.upper(); twice = twice + "!"
bound: str = bindable("d"); bound = bound.upper()
</script>

<p>{text}|{tally}|{left}|{right}|{twice}|{bound}</p>
