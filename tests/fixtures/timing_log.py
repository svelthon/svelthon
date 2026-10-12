# What the bodies of the modules below record as they run.
entries = []
flaky_runs = 0
flaky_store_runs = 0


def recorded():
    return " ".join(entries)
