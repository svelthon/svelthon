# Binds a name, then fails, the first time only.
import timing_log

timing_log.flaky_runs += 1
if timing_log.flaky_runs == 1:
    first = True
    raise ValueError("first attempt")


def fresh():
    return "first" not in globals()
