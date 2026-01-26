import csv
import os
from datetime import datetime
from typing import Iterable, Optional

import asyncpg


DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql://gaveurs_admin:gaveurs_secure_2024@gaveurs_timescaledb:5432/gaveurs_db",
)


def _exports_dir() -> str:
    base_dir = os.getenv("EXPORTS_DIR", "/app/exports")
    csv_dir = os.path.join(base_dir, "csv")
    os.makedirs(csv_dir, exist_ok=True)
    return csv_dir


def _dt_suffix() -> str:
    return datetime.utcnow().strftime("%Y%m%d_%H%M%S")


async def export_sqal_csv(lot_id: Optional[int] = None, date_debut: Optional[str] = None, date_fin: Optional[str] = None) -> str:
    """Export SQAL samples from sensor_samples table to a CSV file.

    Args:
        lot_id: optional lot filter
        date_debut: optional start date/time (ISO or YYYY-MM-DD)
        date_fin: optional end date/time (ISO or YYYY-MM-DD)

    Returns:
        Absolute path to the generated CSV file.
    """

    where = []
    args = []

    if lot_id is not None:
        where.append(f"lot_id = ${len(args) + 1}")
        args.append(lot_id)

    if date_debut:
        where.append(f"timestamp >= ${len(args) + 1}::timestamptz")
        args.append(date_debut)

    if date_fin:
        where.append(f"timestamp < ${len(args) + 1}::timestamptz")
        args.append(date_fin)

    where_sql = ("WHERE " + " AND ".join(where)) if where else ""

    sql = f"""
        SELECT
            timestamp,
            sample_id,
            device_id,
            lot_id,
            vl53l8ch_volume_mm3,
            vl53l8ch_surface_uniformity,
            vl53l8ch_quality_score,
            vl53l8ch_grade,
            as7341_freshness_index,
            as7341_fat_quality_index,
            as7341_oxidation_index,
            as7341_quality_score,
            fusion_final_score,
            fusion_final_grade
        FROM sensor_samples
        {where_sql}
        ORDER BY timestamp DESC
        LIMIT 200000
    """

    csv_path = os.path.join(_exports_dir(), f"sqal_export_{_dt_suffix()}.csv")

    conn = await asyncpg.connect(DATABASE_URL)
    try:
        rows = await conn.fetch(sql, *args)
    finally:
        await conn.close()

    with open(csv_path, "w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f, delimiter=";")
        writer.writerow(
            [
                "timestamp",
                "sample_id",
                "device_id",
                "lot_id",
                "vl53l8ch_volume_mm3",
                "vl53l8ch_surface_uniformity",
                "vl53l8ch_quality_score",
                "vl53l8ch_grade",
                "as7341_freshness_index",
                "as7341_fat_quality_index",
                "as7341_oxidation_index",
                "as7341_quality_score",
                "fusion_final_score",
                "fusion_final_grade",
            ]
        )
        for r in rows:
            writer.writerow(
                [
                    r.get("timestamp"),
                    r.get("sample_id"),
                    r.get("device_id"),
                    r.get("lot_id"),
                    r.get("vl53l8ch_volume_mm3"),
                    r.get("vl53l8ch_surface_uniformity"),
                    r.get("vl53l8ch_quality_score"),
                    r.get("vl53l8ch_grade"),
                    r.get("as7341_freshness_index"),
                    r.get("as7341_fat_quality_index"),
                    r.get("as7341_oxidation_index"),
                    r.get("as7341_quality_score"),
                    r.get("fusion_final_score"),
                    r.get("fusion_final_grade"),
                ]
            )

    return csv_path


async def export_gavage_csv(lot_id: Optional[int] = None, date_debut: Optional[str] = None, date_fin: Optional[str] = None) -> str:
    where = []
    args = []

    if lot_id is not None:
        where.append(f"lot_gavage_id = ${len(args) + 1}")
        args.append(lot_id)

    if date_debut:
        where.append(f"time >= ${len(args) + 1}::timestamptz")
        args.append(date_debut)

    if date_fin:
        where.append(f"time < ${len(args) + 1}::timestamptz")
        args.append(date_fin)

    where_sql = ("WHERE " + " AND ".join(where)) if where else ""

    sql = f"""
        SELECT *
        FROM gavage_data_lots
        {where_sql}
        ORDER BY time DESC
        LIMIT 200000
    """

    csv_path = os.path.join(_exports_dir(), f"gavage_export_{_dt_suffix()}.csv")

    conn = await asyncpg.connect(DATABASE_URL)
    try:
        rows = await conn.fetch(sql, *args)
    finally:
        await conn.close()

    with open(csv_path, "w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f, delimiter=";")
        if rows:
            writer.writerow(list(rows[0].keys()))
            for r in rows:
                writer.writerow([r.get(k) for k in rows[0].keys()])

    return csv_path


async def export_feedbacks_csv(date_debut: Optional[str] = None, date_fin: Optional[str] = None) -> str:
    where = []
    args = []

    if date_debut:
        where.append(f"time >= ${len(args) + 1}::timestamptz")
        args.append(date_debut)

    if date_fin:
        where.append(f"time < ${len(args) + 1}::timestamptz")
        args.append(date_fin)

    where_sql = ("WHERE " + " AND ".join(where)) if where else ""

    sql = f"""
        SELECT *
        FROM consumer_feedbacks
        {where_sql}
        ORDER BY time DESC
        LIMIT 200000
    """

    csv_path = os.path.join(_exports_dir(), f"consumer_feedbacks_export_{_dt_suffix()}.csv")

    conn = await asyncpg.connect(DATABASE_URL)
    try:
        rows = await conn.fetch(sql, *args)
    finally:
        await conn.close()

    with open(csv_path, "w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f, delimiter=";")
        if rows:
            writer.writerow(list(rows[0].keys()))
            for r in rows:
                writer.writerow([r.get(k) for k in rows[0].keys()])

    return csv_path


async def export_batch_lots_csv(lot_ids: Iterable[int]) -> str:
    lot_ids_list = list(lot_ids)
    if not lot_ids_list:
        raise ValueError("lot_ids cannot be empty")

    sql = """
        SELECT *
        FROM lots_gavage
        WHERE id = ANY($1::int[])
        ORDER BY id
    """

    csv_path = os.path.join(_exports_dir(), f"lots_export_{_dt_suffix()}.csv")

    conn = await asyncpg.connect(DATABASE_URL)
    try:
        rows = await conn.fetch(sql, lot_ids_list)
    finally:
        await conn.close()

    with open(csv_path, "w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f, delimiter=";")
        if rows:
            writer.writerow(list(rows[0].keys()))
            for r in rows:
                writer.writerow([r.get(k) for k in rows[0].keys()])

    return csv_path
