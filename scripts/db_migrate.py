#!/usr/bin/env python3
"""
Database Migration Script for Système Gaveurs V3.0
Applies SQL schema files to TimescaleDB
"""

import asyncpg
import asyncio
import sys
import os
from pathlib import Path
from datetime import datetime
from typing import List, Tuple
import argparse

# Colors for terminal output
class Colors:
    GREEN = '\033[92m'
    YELLOW = '\033[93m'
    RED = '\033[91m'
    BLUE = '\033[94m'
    CYAN = '\033[96m'
    BOLD = '\033[1m'
    END = '\033[0m'


class DatabaseMigrator:
    """Database migration utility"""

    def __init__(self, host: str = "localhost", port: int = 5432,
                 database: str = "gaveurs_db", user: str = "gaveurs_admin",
                 password: str = "gaveurs_secure_2024"):
        self.host = host
        self.port = port
        self.database = database
        self.user = user
        self.password = password
        self.conn = None

        # Project root
        self.project_root = Path(__file__).parent.parent

        # SQL files to execute in order
        self.schema_files = [
            "backend/scripts/timescaledb_schema.sql",
            "backend/scripts/sqal_timescaledb_schema.sql",
            "backend/scripts/consumer_feedback_schema.sql"
        ]

    def print_header(self):
        """Print header"""
        print(f"\n{Colors.CYAN}{'='*70}{Colors.END}")
        print(f"{Colors.CYAN}{Colors.BOLD}Système Gaveurs V3.0 - Database Migration{Colors.END}")
        print(f"{Colors.CYAN}{'='*70}{Colors.END}\n")
        print(f"Timestamp: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        print(f"Database:  {self.database}@{self.host}:{self.port}\n")

    def log_info(self, message: str):
        """Log info message"""
        print(f"{Colors.BLUE}[INFO]{Colors.END} {message}")

    def log_success(self, message: str):
        """Log success message"""
        print(f"{Colors.GREEN}[SUCCESS]{Colors.END} {message}")

    def log_warning(self, message: str):
        """Log warning message"""
        print(f"{Colors.YELLOW}[WARNING]{Colors.END} {message}")

    def log_error(self, message: str):
        """Log error message"""
        print(f"{Colors.RED}[ERROR]{Colors.END} {message}")

    async def connect(self) -> bool:
        """Connect to database"""
        try:
            self.log_info(f"Connecting to {self.host}:{self.port}/{self.database}...")

            self.conn = await asyncpg.connect(
                host=self.host,
                port=self.port,
                database=self.database,
                user=self.user,
                password=self.password,
                timeout=10
            )

            self.log_success("Connected to database")
            return True

        except asyncpg.InvalidCatalogNameError:
            self.log_error(f"Database '{self.database}' does not exist")
            return False
        except asyncpg.InvalidPasswordError:
            self.log_error("Invalid username or password")
            return False
        except Exception as e:
            self.log_error(f"Connection failed: {str(e)}")
            return False

    async def disconnect(self):
        """Disconnect from database"""
        if self.conn:
            await self.conn.close()
            self.log_info("Disconnected from database")

    async def check_timescaledb_extension(self) -> bool:
        """Check if TimescaleDB extension is installed"""
        try:
            result = await self.conn.fetch(
                "SELECT * FROM pg_extension WHERE extname = 'timescaledb'"
            )

            if result:
                version = await self.conn.fetchval(
                    "SELECT extversion FROM pg_extension WHERE extname = 'timescaledb'"
                )
                self.log_success(f"TimescaleDB extension found (version {version})")
                return True
            else:
                self.log_warning("TimescaleDB extension not found, attempting to create...")

                try:
                    await self.conn.execute("CREATE EXTENSION IF NOT EXISTS timescaledb")
                    self.log_success("TimescaleDB extension created")
                    return True
                except Exception as e:
                    self.log_error(f"Failed to create TimescaleDB extension: {str(e)}")
                    return False

        except Exception as e:
            self.log_error(f"Failed to check TimescaleDB extension: {str(e)}")
            return False

    async def execute_sql_file(self, file_path: Path) -> Tuple[bool, int]:
        """Execute SQL file"""
        try:
            if not file_path.exists():
                self.log_error(f"File not found: {file_path}")
                return False, 0

            self.log_info(f"Executing {file_path.name}...")

            # Read SQL file
            with open(file_path, 'r', encoding='utf-8') as f:
                sql_content = f.read()

            # Split into statements (simple split on semicolon)
            statements = [stmt.strip() for stmt in sql_content.split(';') if stmt.strip()]

            executed_count = 0

            for i, statement in enumerate(statements, 1):
                try:
                    # Skip comments and empty lines
                    if statement.startswith('--') or not statement:
                        continue

                    # Execute statement
                    await self.conn.execute(statement)
                    executed_count += 1

                except asyncpg.DuplicateTableError:
                    self.log_warning(f"  Statement {i}: Table already exists (skipping)")
                except asyncpg.DuplicateObjectError:
                    self.log_warning(f"  Statement {i}: Object already exists (skipping)")
                except Exception as e:
                    self.log_warning(f"  Statement {i}: {str(e)[:100]}")

            self.log_success(f"Executed {executed_count} statements from {file_path.name}")
            return True, executed_count

        except Exception as e:
            self.log_error(f"Failed to execute {file_path.name}: {str(e)}")
            return False, 0

    async def apply_migrations(self) -> bool:
        """Apply all migration files"""
        self.log_info("Applying migrations...")

        total_statements = 0
        all_success = True

        for schema_file in self.schema_files:
            file_path = self.project_root / schema_file

            success, count = await self.execute_sql_file(file_path)
            total_statements += count

            if not success:
                all_success = False

            print()  # Empty line between files

        if all_success:
            self.log_success(f"All migrations applied successfully ({total_statements} statements)")
        else:
            self.log_warning("Some migrations had warnings or errors")

        return all_success

    async def verify_schema(self) -> bool:
        """Verify database schema"""
        self.log_info("Verifying database schema...")

        try:
            # Check tables
            tables = await self.conn.fetch("""
                SELECT table_name
                FROM information_schema.tables
                WHERE table_schema = 'public'
                AND table_type = 'BASE TABLE'
                ORDER BY table_name
            """)

            self.log_success(f"Found {len(tables)} tables:")
            for table in tables[:10]:  # Show first 10
                print(f"  - {table['table_name']}")

            if len(tables) > 10:
                print(f"  ... and {len(tables) - 10} more")

            print()

            # Check hypertables
            hypertables = await self.conn.fetch("""
                SELECT hypertable_name
                FROM timescaledb_information.hypertables
                ORDER BY hypertable_name
            """)

            if hypertables:
                self.log_success(f"Found {len(hypertables)} hypertables:")
                for ht in hypertables:
                    print(f"  - {ht['hypertable_name']}")
            else:
                self.log_warning("No hypertables found")

            print()

            # Check continuous aggregates
            try:
                caggs = await self.conn.fetch("""
                    SELECT view_name
                    FROM timescaledb_information.continuous_aggregates
                    ORDER BY view_name
                """)

                if caggs:
                    self.log_success(f"Found {len(caggs)} continuous aggregates:")
                    for cagg in caggs:
                        print(f"  - {cagg['view_name']}")
                else:
                    self.log_info("No continuous aggregates found")

            except Exception:
                self.log_info("No continuous aggregates found")

            return True

        except Exception as e:
            self.log_error(f"Failed to verify schema: {str(e)}")
            return False

    async def run(self) -> int:
        """Run migration process"""
        self.print_header()

        # Connect to database
        if not await self.connect():
            return 1

        try:
            # Check TimescaleDB extension
            if not await self.check_timescaledb_extension():
                return 1

            print()

            # Apply migrations
            if not await self.apply_migrations():
                return 1

            # Verify schema
            if not await self.verify_schema():
                return 1

            print(f"\n{Colors.GREEN}{Colors.BOLD}✅ DATABASE MIGRATION COMPLETED SUCCESSFULLY{Colors.END}\n")
            return 0

        except Exception as e:
            self.log_error(f"Migration failed: {str(e)}")
            return 1

        finally:
            await self.disconnect()


async def main():
    """Main entry point"""
    parser = argparse.ArgumentParser(description="Database migration tool for Système Gaveurs V3.0")

    parser.add_argument("--host", default="localhost", help="Database host (default: localhost)")
    parser.add_argument("--port", type=int, default=5432, help="Database port (default: 5432)")
    parser.add_argument("--database", default="gaveurs_db", help="Database name (default: gaveurs_db)")
    parser.add_argument("--user", default="gaveurs_admin", help="Database user (default: gaveurs_admin)")
    parser.add_argument("--password", default="gaveurs_secure_2024", help="Database password")

    args = parser.parse_args()

    migrator = DatabaseMigrator(
        host=args.host,
        port=args.port,
        database=args.database,
        user=args.user,
        password=args.password
    )

    exit_code = await migrator.run()
    sys.exit(exit_code)


if __name__ == "__main__":
    asyncio.run(main())
