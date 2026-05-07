"""Pytest fixtures for AgentForge backend tests.

Provides:
- test_client: async HTTP client backed by an in-memory SQLite database
- demo_agent_config: the refund agent JSON from target_configs
- sample_harnesses: 20 generated adversarial harnesses
"""

import json
from pathlib import Path

import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker

from main import app
from database import Base, get_db
from config import settings

TEST_DATABASE_URL = "sqlite+aiosqlite://"


@pytest_asyncio.fixture(scope="session")
async def engine():
    """Session-scoped in-memory SQLite engine with all tables created."""
    test_engine = create_async_engine(TEST_DATABASE_URL, echo=False)
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield test_engine
    await test_engine.dispose()


@pytest_asyncio.fixture
async def test_client(engine):
    """Async HTTP client wired to the FastAPI app with an isolated database.

    Overrides the ``get_db`` dependency so every test uses a fresh
    session on the in-memory engine. No state leaks between tests.
    """
    TestSession = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async def override_get_db():
        async with TestSession() as session:
            try:
                yield session
                await session.commit()
            except Exception:
                await session.rollback()
                raise

    app.dependency_overrides[get_db] = override_get_db

    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://test",
    ) as ac:
        yield ac

    app.dependency_overrides.clear()


@pytest_asyncio.fixture
async def demo_agent_config():
    """Load the RefundBot-3000 agent configuration from target_configs."""
    config_path = Path(settings.target_configs_dir) / "refund_agent.json"
    with open(config_path) as f:
        return json.load(f)


@pytest.fixture
def sample_harnesses():
    """Generate 20 sample adversarial test harnesses.

    Uses the same internal helper that ``/api/agent-hardening/spawn-harnesses``
    calls, so these harnesses match the shape the backend works with.
    """
    from routes.agent_hardening import _generate_default_harnesses
    return _generate_default_harnesses(20)
