# Imports whose module runs when the statement does, and only then.
import timing_log

if False:
    import timing_never
if False:
    from timing_never import value

timing_log.entries.append("before")
import timing_first
timing_log.entries.append("after")

try:
    import timing_fails
except ValueError:
    timing_log.entries.append("caught")


def later():
    import timing_later
    return timing_later.value


def again():
    try:
        import timing_fails
    except ValueError:
        timing_log.entries.append("caught again")
