<script lang="python">
def gen():
    for i in range(4):
        yield i * i

squares = list(gen())
genexp = sum(x * x for x in range(5))

def late_binding():
    fns = []
    for i in range(3):
        fns.append(lambda: i)
    return [f() for f in fns]

late = late_binding()

def with_nonlocal():
    n = 0
    def inc():
        nonlocal n
        n += 1
    inc()
    inc()
    return n

nl = with_nonlocal()

order = []

def try_finally():
    try:
        order.append("try")
        return "ret"
    finally:
        order.append("finally")

ret = try_finally()
flow = ",".join(order)

_ = [q for q in range(3)]
try:
    q
    leaked = True
except NameError:
    leaked = False

# The name existed before: the comprehension must hand it back untouched.
kept = "before"
_ = [kept for kept in range(3)]

# Every other form binds a name too, and none of them may leak either.
_ = [r for r in range(2)]
_ = {s: s for s in range(2)}
_ = {t for t in range(2)}
_ = list(u for u in range(2))
_ = [[a for a in range(2)] for b in range(2)]

forms = []
for one in ("r", "s", "t", "u", "a", "b"):
    try:
        globals()[one]
        forms.append(one)
    except KeyError:
        pass

leaked_forms = ",".join(forms)

def scoped():
    [w for w in range(3)]
    try:
        w
        return True
    except NameError:
        return False

leaked_in_func = scoped()

def chained():
    try:
        1 / 0
    except ZeroDivisionError as e:
        raise ValueError("wrapped") from e

try:
    chained()
except ValueError as e:
    cause = type(e.__cause__).__name__

report = "\n".join([
    f"squares={squares!r}",
    f"genexp={genexp!r}",
    f"late={late!r}",
    f"nl={nl!r}",
    f"ret={ret!r}",
    f"flow={flow!r}",
    f"leaked={leaked!r}",
    f"kept={kept!r}",
    f"leaked_forms={leaked_forms!r}",
    f"leaked_in_func={leaked_in_func!r}",
    f"cause={cause!r}",
])
</script>

<pre>{report}</pre>
