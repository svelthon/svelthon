<script lang="python">
# `_sys`, not `sys`. Brython installs `_sys` itself, the way it installs
# `browser`, so it is there with nothing shipped alongside the engine. `sys` is a
# stdlib module, and Svelthon does not ship a stdlib: a need that is identified
# becomes a builtin of ours, never an import the author has to remember.
import _sys

def own_name():
    return _sys._getframe().f_code.co_name

def caller_name():
    return _sys._getframe(1).f_code.co_name

def outer():
    return caller_name()

def line_delta():
    a = _sys._getframe().f_lineno
    b = _sys._getframe().f_lineno
    return b - a

name = own_name()
caller = outer()
delta = line_delta()

def level3():
    raise ValueError("deep")

def level2():
    level3()

def level1():
    level2()

try:
    level1()
except ValueError as e:
    tb, depth = e.__traceback__, 0
    while tb is not None:
        depth += 1
        tb = tb.tb_next
    msg = str(e)

report = "\n".join([
    f"name={name!r}",
    f"caller={caller!r}",
    f"delta={delta!r}",
    f"depth={depth!r}",
    f"msg={msg!r}",
])
</script>

<pre>{report}</pre>
