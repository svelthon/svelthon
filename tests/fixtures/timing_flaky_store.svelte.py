# Binds a name, then fails, the first time only; and keeps hold of itself.
import timing_log
import timing_flaky_store as itself

timing_log.flaky_store_modules.append(itself)
timing_log.flaky_store_runs += 1
if timing_log.flaky_store_runs == 1:
    first = True
    raise ValueError("first attempt")

fresh = "first" not in globals()
