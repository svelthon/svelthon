<script lang="python">
emoji_len = len("😀")
emoji_ord = ord("😀")
rev = "abcdé"[::-1]
last = "hello"[-2]
prec = f"{3.14159:.2f}"
pad = f"{42:>5}"
sign = f"{7:+d}"
sharp = "straße".upper()
joined = ", ".join(sorted({"pomme", "abricot", "banane"}))
mult = "ab" * 3

report = "\n".join([
    f"emoji_len={emoji_len!r}",
    f"emoji_ord={emoji_ord!r}",
    f"rev={rev!r}",
    f"last={last!r}",
    f"prec={prec!r}",
    f"pad={pad!r}",
    f"sign={sign!r}",
    f"sharp={sharp!r}",
    f"joined={joined!r}",
    f"mult={mult!r}",
])
</script>

<pre>{report}</pre>
