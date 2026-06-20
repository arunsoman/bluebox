from dotenv import find_dotenv, load_dotenv

# Loaded here, at the package root, so it runs before any submodule -
# including `shared_kernel.llm.connector`, whose `LLMSettings`/`PROVIDERS`
# resolution reads these vars at *import* time (every module's
# `llm/agents.py` builds its Agents at module scope). Loading later (e.g. in
# `interfaces.api.app`) would be too late: by the time that module's own
# imports run, agents.py modules importable from it have already read a
# half-populated environment. `find_dotenv` walks up from the cwd so this
# works whether uvicorn is launched from `be/` or its parent.
load_dotenv(find_dotenv(usecwd=True))


def main() -> None:
    print("Hello from bluebox!")
