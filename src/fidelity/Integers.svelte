<script lang="python">
big = 2 ** 70
mul = 3037000500 * 3037000500
floor = -7 // 2
mod = -7 % 2
dm = divmod(-7, 2)
tdiv = 7 / 2
shift = 1 << 100
negpow = (-2) ** 3
inexact = 0.1 + 0.2

report = "\n".join([
    f"big={big!r}",
    f"mul={mul!r}",
    f"floor={floor!r}",
    f"mod={mod!r}",
    f"dm={dm!r}",
    f"tdiv={tdiv!r}",
    f"shift={shift!r}",
    f"negpow={negpow!r}",
    f"inexact={inexact!r}",
])
</script>

<pre>{report}</pre>
