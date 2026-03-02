"""Simple MongoDB connection test script."""
import asyncio
from app.db.connection import connect_db, disconnect_db
from app.models.user import User


async def test_connection():
    print("[DB Test] Starting database connectivity test...")
    try:
        await connect_db()
        print("[DB Test] Connection successful!")
        # Count users as a simple read test
        count = await User.count()
        print(f"[DB Test] Found {count} users in database")
        print("[DB Test] ✅ All tests passed!")
    except Exception as e:
        print(f"[DB Test] ❌ Failed: {e}")
    finally:
        await disconnect_db()


if __name__ == "__main__":
    asyncio.run(test_connection())
