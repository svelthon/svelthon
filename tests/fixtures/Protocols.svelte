<script lang="python">
class Acc:
    def __init__(self, n):
        self.n = n
    def __iadd__(self, other):
        self.n += other * 10
        return self
    def __add__(self, other):
        return Acc(self.n + other)
    def __repr__(self):
        return f"Acc({self.n})"

inplace = Acc(1)
inplace += 2
plain = Acc(1) + 2

class Rev:
    def __radd__(self, other):
        return f"radd({other})"

radd = 1 + Rev()

class Meta:
    def __init__(self):
        self.base = 21
    @property
    def double(self):
        return self.base * 2
    def __getattr__(self, name):
        return f"missing:{name}"
    def __len__(self):
        return 3
    def __getitem__(self, k):
        return k * 2

m = Meta()
prop = m.double
fallback = m.nope
length = len(m)
item = m[4]

class Slotted:
    __slots__ = ("a",)
    def __init__(self):
        self.a = 1

try:
    s = Slotted()
    s.b = 2
    slots = "no error"
except AttributeError:
    slots = "AttributeError"

report = "\n".join([
    f"inplace={inplace!r}",
    f"plain={plain!r}",
    f"radd={radd!r}",
    f"prop={prop!r}",
    f"fallback={fallback!r}",
    f"length={length!r}",
    f"item={item!r}",
    f"slots={slots!r}",
])
</script>

<pre>{report}</pre>
