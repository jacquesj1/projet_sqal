"""Test database connection with asyncpg"""
import asyncio
import asyncpg

async def test_connection():
    try:
        print("Testing connection to localhost:5432...")

        # Try with ssl=False
        conn = await asyncpg.connect(
            host='localhost',
            port=5432,
            user='gaveurs_admin',
            password='gaveurs_secure_2024',
            database='gaveurs_db',
            ssl=False
        )

        result = await conn.fetchval('SELECT 1')
        print(f"✅ SUCCESS! Query result: {result}")

        await conn.close()

    except Exception as e:
        print(f"❌ FAILED: {type(e).__name__}: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(test_connection())
