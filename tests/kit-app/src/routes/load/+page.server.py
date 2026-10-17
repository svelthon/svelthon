# A route module, which SvelteKit loads when it decides.
def load(event):
    return {"answer": 6 * 7, "rows": [n * n for n in range(4)]}
