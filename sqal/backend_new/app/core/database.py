"""
TimescaleDB Database Configuration
Advanced time-series database setup with hypertables and continuous aggregates
"""
# Load .env FIRST before any other imports
import os
from pathlib import Path
from dotenv import load_dotenv

# Get the project root directory (backend_new)
BASE_DIR = Path(__file__).resolve().parent.parent.parent
env_path = BASE_DIR / '.env'

# Load environment variables from .env file
if env_path.exists():
    load_dotenv(dotenv_path=env_path)
    print(f"✅ Loaded .env from: {env_path}")
else:
    print(f"⚠️ Warning: .env file not found at {env_path}")

from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import declarative_base
from sqlalchemy import text
import logging

logger = logging.getLogger(__name__)

# Database URL from environment
DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql://foiegras_user:foiegras_pass_2025@timescaledb:5432/foiegras_db"
)

print(f"🔍 Using DATABASE_URL: {DATABASE_URL[:60]}...")

# Convert to async URL
ASYNC_DATABASE_URL = DATABASE_URL.replace("postgresql://", "postgresql+asyncpg://")

# Database URL from environment
DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql://foiegras_user:foiegras_pass_2025@timescaledb:5432/foiegras_db"
)

# Convert to async URL
ASYNC_DATABASE_URL = DATABASE_URL.replace("postgresql://", "postgresql+asyncpg://")

# Create async engine with connection pooling
engine = create_async_engine(
    ASYNC_DATABASE_URL,
    echo=False,  # Set to True for SQL query logging
    pool_size=10,
    max_overflow=20,
    pool_pre_ping=True,  # Verify connections before using
    pool_recycle=3600,  # Recycle connections after 1 hour
)

# Create async session factory
AsyncSessionLocal = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False,
)

# Base class for models
Base = declarative_base()


async def init_db():
    """
    Initialize database with TimescaleDB extension and create all tables
    """
    async with engine.begin() as conn:
        # Create TimescaleDB extension
        await conn.execute(text("CREATE EXTENSION IF NOT EXISTS timescaledb CASCADE;"))
        
        # Create all SQLAlchemy tables FIRST
        await conn.run_sync(Base.metadata.create_all)
        
        logger.info("✅ Database initialized with TimescaleDB extension and tables created")


async def create_hypertable(table_name: str, time_column: str = "timestamp"):
    """
    Convert a regular table to a TimescaleDB hypertable
    """
    async with engine.begin() as conn:
        try:
            # Create hypertable
            await conn.execute(text(f"""
                SELECT create_hypertable(
                    '{table_name}',
                    '{time_column}',
                    if_not_exists => TRUE,
                    chunk_time_interval => INTERVAL '1 day'
                );
            """))
            logger.info(f"✅ Hypertable created: {table_name}")
        except Exception as e:
            logger.warning(f"Hypertable {table_name} may already exist: {e}")


async def create_continuous_aggregate(
    view_name: str,
    source_table: str,
    time_column: str,
    bucket_interval: str,
    select_clause: str
):
    """
    Create a continuous aggregate (materialized view) for real-time analytics
    
    Example:
        await create_continuous_aggregate(
            view_name="sensor_data_hourly",
            source_table="sensor_samples",
            time_column="timestamp",
            bucket_interval="1 hour",
            select_clause="device_id, AVG(quality_score) as avg_quality, COUNT(*) as sample_count"
        )
    """
    async with engine.begin() as conn:
        try:
            await conn.execute(text(f"""
                CREATE MATERIALIZED VIEW IF NOT EXISTS {view_name}
                WITH (timescaledb.continuous) AS
                SELECT
                    time_bucket('{bucket_interval}', {time_column}) AS bucket,
                    {select_clause}
                FROM {source_table}
                GROUP BY bucket
                WITH NO DATA;
            """))
            
            # Add refresh policy (refresh every 1 hour, covering last 24 hours)
            await conn.execute(text(f"""
                SELECT add_continuous_aggregate_policy('{view_name}',
                    start_offset => INTERVAL '24 hours',
                    end_offset => INTERVAL '1 hour',
                    schedule_interval => INTERVAL '1 hour',
                    if_not_exists => TRUE
                );
            """))
            
            logger.info(f"✅ Continuous aggregate created: {view_name}")
        except Exception as e:
            logger.warning(f"Continuous aggregate {view_name} may already exist: {e}")


async def add_compression_policy(table_name: str, compress_after: str = "7 days"):
    """
    Add automatic compression policy to reduce storage
    Compresses data older than specified interval
    """
    async with engine.begin() as conn:
        try:
            # Enable compression
            await conn.execute(text(f"""
                ALTER TABLE {table_name} SET (
                    timescaledb.compress,
                    timescaledb.compress_segmentby = 'device_id'
                );
            """))
            
            # Add compression policy
            await conn.execute(text(f"""
                SELECT add_compression_policy('{table_name}',
                    compress_after => INTERVAL '{compress_after}',
                    if_not_exists => TRUE
                );
            """))
            
            logger.info(f"✅ Compression policy added: {table_name} (after {compress_after})")
        except Exception as e:
            logger.warning(f"Compression policy for {table_name} may already exist: {e}")


async def add_retention_policy(table_name: str, retain_for: str = "90 days"):
    """
    Add automatic retention policy to drop old data
    Automatically removes data older than specified interval
    """
    async with engine.begin() as conn:
        try:
            await conn.execute(text(f"""
                SELECT add_retention_policy('{table_name}',
                    drop_after => INTERVAL '{retain_for}',
                    if_not_exists => TRUE
                );
            """))
            
            logger.info(f"✅ Retention policy added: {table_name} (retain {retain_for})")
        except Exception as e:
            logger.warning(f"Retention policy for {table_name} may already exist: {e}")


async def get_db():
    """
    Dependency for FastAPI endpoints to get database session
    """
    async with AsyncSessionLocal() as session:
        try:
            yield session
        finally:
            await session.close()


async def close_db():
    """
    Close database connections
    """
    await engine.dispose()
    logger.info("🛑 Database connections closed")
