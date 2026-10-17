# A module SvelteKit takes for one of remote functions by its name, with or
# without SvelteKit: its body runs as it loads, not at the import statement.
import timing_log

timing_log.entries.append("remote")
