import os
from typing import AsyncGenerator

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine


def _to_sqlalchemy_async_url(database_url: str) -> str:
    if database_url.startswith("postgresql+asyncpg://"):
        return database_url

    if database_url.startswith("postgresql://"):
        return database_url.replace("postgresql://", "postgresql+asyncpg://", 1)

    return database_url


def get_database_url() -> str:
    return os.getenv(
        "DATABASE_URL",
        "postgresql://gaveurs_admin:gaveurs_secure_2024@timescaledb:5432/gaveurs_db",
    )


DATABASE_URL_ASYNC = _to_sqlalchemy_async_url(get_database_url())

engine = create_async_engine(DATABASE_URL_ASYNC, pool_pre_ping=True)
AsyncSessionLocal = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)


async def get_async_session() -> AsyncGenerator[AsyncSession, None]:
    async with AsyncSessionLocal() as session:
        yield session
