"""Test configuration: isolated data dir, file-backed SQLite, mock provider, no simulated delays."""

import os
import tempfile

_TMP = tempfile.mkdtemp(prefix="agentlabs-test-")
os.environ["AGENTLABS_DATA_DIR"] = _TMP
os.environ["AGENTLABS_LLM_PROVIDER"] = "mock"
os.environ["OPENAI_API_KEY"] = ""
os.environ["AGENTLABS_SIM_STEP_DELAY"] = "0"
os.environ["AGENTLABS_FRONTEND_DIST"] = os.path.join(_TMP, "no-frontend")
os.environ.setdefault("AGENTLABS_LOCAL_MODEL_PATHS", os.environ.get("AGENTLABS_TEST_MODEL_PATH", ""))

import pytest  # noqa: E402
import pytest_asyncio  # noqa: E402
from httpx import ASGITransport, AsyncClient  # noqa: E402

import database  # noqa: E402

database.configure_engine(f"sqlite+aiosqlite:///{os.path.join(_TMP, 'test.db')}")


@pytest_asyncio.fixture(scope="session", autouse=True)
async def _db():
    await database.init_db()
    yield


@pytest_asyncio.fixture
async def client():
    from main import app

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test", timeout=600) as ac:
        yield ac


@pytest.fixture
def refund_config():
    from routes.hardening import demo_config

    return demo_config()
