#!/usr/bin/env python3
"""
Update total_corn_real_g for existing lots from CSV
"""

import asyncio
import asyncpg
import csv
from decimal import Decimal

DATABASE_URL = "postgresql://gaveurs_admin:gaveurs_secure_2024@gaveurs_timescaledb:5432/gaveurs_db"
CSV_PATH = "/app/data.csv"


def parse_decimal(value: str):
    """Parse decimal from CSV"""
    if not value or value == "nan" or value == "":
        return None
    try:
        value_clean = value.replace(",", ".")
        return Decimal(value_clean)
    except:
        return None


async def main():
    print("=" * 80)
    print("UPDATE total_corn_real_g FROM CSV")
    print("=" * 80)
    print()

    conn = await asyncpg.connect(DATABASE_URL)

    try:
        # Read CSV
        with open(CSV_PATH, 'r', encoding='latin-1') as f:
            reader = csv.DictReader(f, delimiter=';')
            rows = list(reader)

        print(f"📂 {len(rows)} rows in CSV")

        updated = 0
        skipped = 0

        for row in rows:
            code_lot = row.get("Code_lot")
            if not code_lot:
                continue

            # Check if lot exists
            lot_id = await conn.fetchval(
                "SELECT id FROM lots_gavage WHERE code_lot = $1", code_lot
            )

            if not lot_id:
                skipped += 1
                continue

            # Get total_cornReal from CSV
            total_corn = parse_decimal(row.get("total_cornReal"))

            if total_corn is None:
                skipped += 1
                continue

            # Update
            await conn.execute(
                "UPDATE lots_gavage SET total_corn_real_g = $1 WHERE id = $2",
                total_corn, lot_id
            )

            updated += 1
            if updated % 10 == 0:
                print(f"✅ {updated} lots updated...")

        print()
        print(f"✅ Total updated: {updated}")
        print(f"⏭️  Skipped: {skipped}")

    finally:
        await conn.close()


if __name__ == "__main__":
    asyncio.run(main())
