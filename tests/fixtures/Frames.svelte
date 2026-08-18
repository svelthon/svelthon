<script lang="python">
import sys

def own_name():
    return sys._getframe().f_code.co_name

def caller_name():
    return sys._getframe(1).f_code.co_name

def outer():
    return caller_name()

def line_delta():
    a = sys._getframe().f_lineno
    b = sys._getframe().f_lineno
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
