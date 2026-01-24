"""
Database Initialization Script
Creates all tables and converts them to TimescaleDB hypertables
"""
import asyncio
import logging
import os
from pathlib import Path

# Load .env file BEFORE importing anything else
from dotenv import load_dotenv

# Get the directory of this script
BASE_DIR = Path(__file__).resolve().parent
env_path = BASE_DIR / '.env'

# Load environment variables
load_dotenv(dotenv_path=env_path)

# Verify DATABASE_URL is loaded
db_url = os.getenv('DATABASE_URL')
if not db_url:
    raise RuntimeError("DATABASE_URL not found in environment variables. Make sure .env file exists.")

print(f"✅ Loaded DATABASE_URL: {db_url[:50]}...")  # Print first 50 chars for verification

from sqlalchemy import text
from app.core.database import engine, Base, init_db, create_hypertable
from app.models import sensor  # Import all models

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


async def initialize_database():
    """
    Initialize database with all tables and TimescaleDB features
    """
    try:
        logger.info("🚀 Starting database initialization...")
        
        # Step 1: Create TimescaleDB extension
        await init_db()
        
        # Step 2: Create all tables
        logger.info("📋 Creating all tables...")
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        logger.info("✅ All tables created successfully")
        
        # Step 3: Convert tables to hypertables
        logger.info("⏰ Converting tables to TimescaleDB hypertables...")
        
        # Convert sensor_samples to hypertable
        await create_hypertable("sensor_samples", "timestamp")
        
        # Convert device_status to hypertable
        await create_hypertable("device_status", "timestamp")
        
        # Convert quality_alerts to hypertable
        await create_hypertable("quality_alerts", "timestamp")
        
        # Convert production_batches to hypertable (using start_time)
        await create_hypertable("production_batches", "start_time")
        
        logger.info("✅ All hypertables created successfully")
        
        # Step 4: Create indexes for better performance
        logger.info("📊 Creating additional indexes...")
        async with engine.begin() as conn:
            # Add composite indexes for common queries
            await conn.execute(text("""
                CREATE INDEX IF NOT EXISTS idx_sensor_device_timestamp 
                ON sensor_samples(device_id, timestamp DESC);
            """))
            
            await conn.execute(text("""
                CREATE INDEX IF NOT EXISTS idx_sensor_grade_timestamp 
                ON sensor_samples(fusion_final_grade, timestamp DESC);
            """))
            
            await conn.execute(text("""
                CREATE INDEX IF NOT EXISTS idx_sensor_score 
                ON sensor_samples(fusion_final_score DESC);
            """))
            
        logger.info("✅ Additional indexes created")
        
        # Step 5: Verify tables exist
        logger.info("🔍 Verifying tables...")
        async with engine.begin() as conn:
            result = await conn.execute(text("""
                SELECT table_name 
                FROM information_schema.tables 
                WHERE table_schema = 'public' 
                ORDER BY table_name;
            """))
            tables = [row[0] for row in result]
            logger.info(f"📋 Tables in database: {', '.join(tables)}")
        
        logger.info("🎉 Database initialization completed successfully!")
        
    except Exception as e:
        logger.error(f"❌ Database initialization failed: {e}")
        raise
    finally:
        await engine.dispose()


if __name__ == "__main__":
    asyncio.run(initialize_database())
