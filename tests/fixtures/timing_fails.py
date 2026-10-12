import timing_log

timing_log.entries.append("fails")
raise ValueError("optional dependency failed")
