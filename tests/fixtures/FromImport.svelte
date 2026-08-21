<script lang="python">
# `import x` and `from x import y` are two different statements to Brython, and
# only the first one was ever exercised. Both forms here, from the same module,
# so a failure says which one broke.
import math
from math import floor
from fractions import Fraction

tau = round(math.tau, 4)
halved = floor(7 / 2)
third = str(Fraction(1, 3) + Fraction(1, 6))
</script>

<p data-k="tau">{tau}</p>
<p data-k="floor">{halved}</p>
<p data-k="third">{third}</p>
