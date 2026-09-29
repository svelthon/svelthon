"""A row every mount of `SharedRowHolder.svelte` puts in a list of its own."""

shared = {"n": 0}


def bump():
    shared["n"] += 1
