"""Create the additive account tables; never alter or delete existing tables.
Run from backend: python -m scripts.setup_accounts
"""
import asyncio
from app.db.session import engine
from app.db.base import Base
from app.models.account import Account
from app.models.user import User
from app.models.occupation import Occupation
from app.models.refresh_token import RefreshToken

async def main():
    try:
        async with engine.begin() as connection:
            await connection.run_sync(lambda conn: Base.metadata.create_all(conn, tables=[Occupation.__table__, User.__table__, Account.__table__, RefreshToken.__table__]))
        print('Account tables are ready.')
    finally:
        await engine.dispose()

if __name__ == '__main__':
    asyncio.run(main())
