# Binds a name, then fails, the first time only; and keeps hold of itself.
import timing_log
import timing_flaky as itself

timing_log.flaky_modules.append(itself)
timing_log.flaky_runs += 1
if timing_log.flaky_runs == 1:
    first = True
    raise ValueError("first attempt")


def fresh():
    return "first" not in globals()
