"""Session-wide test setup.

Sets `BLUEBOX_DB_PATH` to a throwaway temp file *before* any `bluebox.*`
module is imported - `AppState` (shared_kernel/infrastructure/in_memory.py)
opens that path as soon as it's first imported (it's a module-level
singleton), so this has to run at conftest module-import time, not inside a
fixture function. pytest imports a directory's conftest.py before
collecting/importing any test module in that directory, which is what
guarantees the ordering here. `setdefault` (not `=`) so an explicitly-set
env var (e.g. a developer pointing tests at a specific file) still wins.

Keeps the real dev `.bluebox.db` untouched by test runs, and gives every
test session a fresh, isolated DB - matching the existing convention (each
test creates its own randomly-id'd project; `app_state` is shared across
the whole session, same as before this file existed).
"""

import os
import tempfile

_tmp_dir = tempfile.mkdtemp(prefix="bluebox-test-db-")
os.environ.setdefault("BLUEBOX_DB_PATH", os.path.join(_tmp_dir, "test.db"))
