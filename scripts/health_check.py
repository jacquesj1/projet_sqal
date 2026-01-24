#!/usr/bin/env python3
"""
Health Check Script for Système Gaveurs V3.0
Verifies all services are running and responsive
"""

import asyncio
import httpx
import sys
import json
from datetime import datetime
from typing import Dict, Any, List, Tuple
import subprocess

# Colors for terminal output
class Colors:
    GREEN = '\033[92m'
    YELLOW = '\033[93m'
    RED = '\033[91m'
    BLUE = '\033[94m'
    CYAN = '\033[96m'
    BOLD = '\033[1m'
    END = '\033[0m'


class HealthChecker:
    """Health check utility for all system components"""

    def __init__(self):
        self.results = []
        self.backend_url = "http://localhost:8000"
        self.frontend_euralis_url = "http://localhost:3000"
        self.frontend_gaveurs_url = "http://localhost:3001"
        self.frontend_sqal_url = "http://localhost:5173"
        self.db_container = "gaveurs_timescaledb"

    def print_header(self):
        """Print header"""
        print(f"\n{Colors.CYAN}{'='*70}{Colors.END}")
        print(f"{Colors.CYAN}{Colors.BOLD}Système Gaveurs V3.0 - Health Check{Colors.END}")
        print(f"{Colors.CYAN}{'='*70}{Colors.END}\n")
        print(f"Timestamp: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")

    def print_result(self, service: str, status: str, message: str = "", details: Dict[str, Any] = None):
        """Print formatted result"""
        if status == "OK":
            icon = f"{Colors.GREEN}✓{Colors.END}"
            status_text = f"{Colors.GREEN}OK{Colors.END}"
        elif status == "WARNING":
            icon = f"{Colors.YELLOW}⚠{Colors.END}"
            status_text = f"{Colors.YELLOW}WARNING{Colors.END}"
        else:
            icon = f"{Colors.RED}✗{Colors.END}"
            status_text = f"{Colors.RED}FAILED{Colors.END}"

        print(f"{icon} {Colors.BOLD}{service:.<30}{Colors.END} {status_text}")

        if message:
            print(f"  └─ {message}")

        if details:
            for key, value in details.items():
                print(f"     {key}: {value}")

        self.results.append({
            "service": service,
            "status": status,
            "message": message,
            "details": details or {}
        })

    async def check_database(self) -> bool:
        """Check TimescaleDB"""
        print(f"\n{Colors.BLUE}[1/7] Checking TimescaleDB...{Colors.END}")

        try:
            # Check if Docker is available
            result = subprocess.run(
                ["docker", "ps", "--format", "{{.Names}}"],
                capture_output=True,
                text=True,
                timeout=5
            )

            if self.db_container not in result.stdout:
                self.print_result(
                    "TimescaleDB",
                    "FAILED",
                    f"Container '{self.db_container}' is not running"
                )
                return False

            # Check if database is ready
            result = subprocess.run(
                ["docker", "exec", self.db_container, "pg_isready", "-U", "gaveurs_admin"],
                capture_output=True,
                text=True,
                timeout=5
            )

            if result.returncode == 0:
                # Get database info
                db_info = subprocess.run(
                    ["docker", "exec", self.db_container, "psql", "-U", "gaveurs_admin", "-d", "gaveurs_db", "-c", "SELECT version();"],
                    capture_output=True,
                    text=True,
                    timeout=5
                )

                self.print_result(
                    "TimescaleDB",
                    "OK",
                    "Database is ready",
                    {"Container": self.db_container, "Port": "5432"}
                )
                return True
            else:
                self.print_result(
                    "TimescaleDB",
                    "FAILED",
                    "Database is not ready"
                )
                return False

        except FileNotFoundError:
            self.print_result(
                "TimescaleDB",
                "FAILED",
                "Docker is not installed or not in PATH"
            )
            return False
        except subprocess.TimeoutExpired:
            self.print_result(
                "TimescaleDB",
                "FAILED",
                "Database health check timed out"
            )
            return False
        except Exception as e:
            self.print_result(
                "TimescaleDB",
                "FAILED",
                f"Unexpected error: {str(e)}"
            )
            return False

    async def check_backend(self) -> bool:
        """Check Backend API"""
        print(f"\n{Colors.BLUE}[2/7] Checking Backend API...{Colors.END}")

        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                # Check health endpoint
                response = await client.get(f"{self.backend_url}/health")

                if response.status_code == 200:
                    data = response.json()

                    details = {
                        "URL": self.backend_url,
                        "Status": data.get("status", "unknown"),
                        "Database": data.get("database", "unknown")
                    }

                    self.print_result(
                        "Backend API",
                        "OK",
                        "API is responsive",
                        details
                    )
                    return True
                else:
                    self.print_result(
                        "Backend API",
                        "FAILED",
                        f"HTTP {response.status_code}"
                    )
                    return False

        except httpx.ConnectError:
            self.print_result(
                "Backend API",
                "FAILED",
                f"Cannot connect to {self.backend_url}"
            )
            return False
        except httpx.TimeoutException:
            self.print_result(
                "Backend API",
                "FAILED",
                "Request timed out"
            )
            return False
        except Exception as e:
            self.print_result(
                "Backend API",
                "FAILED",
                f"Unexpected error: {str(e)}"
            )
            return False

    async def check_api_endpoints(self) -> bool:
        """Check critical API endpoints"""
        print(f"\n{Colors.BLUE}[3/7] Checking API Endpoints...{Colors.END}")

        endpoints = [
            ("/api/euralis/sites/", "Euralis Sites"),
            ("/api/gaveurs/gaveurs/", "Gaveurs Management"),
            ("/api/sqal/devices/", "SQAL Devices"),
            ("/api/consumer/health", "Consumer Feedback")
        ]

        all_ok = True

        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                for path, name in endpoints:
                    try:
                        response = await client.get(f"{self.backend_url}{path}")

                        if response.status_code in [200, 404]:  # 404 is OK for empty lists
                            self.print_result(
                                f"  {name}",
                                "OK",
                                f"{path}"
                            )
                        else:
                            self.print_result(
                                f"  {name}",
                                "WARNING",
                                f"HTTP {response.status_code}"
                            )
                            all_ok = False

                    except Exception as e:
                        self.print_result(
                            f"  {name}",
                            "FAILED",
                            str(e)
                        )
                        all_ok = False

                return all_ok

        except Exception as e:
            self.print_result(
                "API Endpoints",
                "FAILED",
                f"Unexpected error: {str(e)}"
            )
            return False

    async def check_websockets(self) -> bool:
        """Check WebSocket endpoints"""
        print(f"\n{Colors.BLUE}[4/7] Checking WebSocket Endpoints...{Colors.END}")

        try:
            import websockets

            # Check sensor WebSocket
            try:
                async with websockets.connect(f"ws://localhost:8000/ws/sensors/", timeout=5) as ws:
                    await ws.send(json.dumps({"type": "ping"}))
                    response = await asyncio.wait_for(ws.recv(), timeout=5.0)

                    self.print_result(
                        "  Sensor WebSocket",
                        "OK",
                        "/ws/sensors/"
                    )
                    ws_sensor_ok = True
            except Exception as e:
                self.print_result(
                    "  Sensor WebSocket",
                    "FAILED",
                    str(e)
                )
                ws_sensor_ok = False

            # Check realtime WebSocket
            try:
                async with websockets.connect(f"ws://localhost:8000/ws/realtime/", timeout=5) as ws:
                    # Just check connection
                    await asyncio.sleep(0.5)

                    self.print_result(
                        "  Realtime WebSocket",
                        "OK",
                        "/ws/realtime/"
                    )
                    ws_realtime_ok = True
            except Exception as e:
                self.print_result(
                    "  Realtime WebSocket",
                    "FAILED",
                    str(e)
                )
                ws_realtime_ok = False

            return ws_sensor_ok and ws_realtime_ok

        except ImportError:
            self.print_result(
                "WebSocket Endpoints",
                "WARNING",
                "websockets library not installed (pip install websockets)"
            )
            return False
        except Exception as e:
            self.print_result(
                "WebSocket Endpoints",
                "FAILED",
                f"Unexpected error: {str(e)}"
            )
            return False

    async def check_frontend_euralis(self) -> bool:
        """Check Frontend Euralis"""
        print(f"\n{Colors.BLUE}[5/7] Checking Frontend Euralis...{Colors.END}")

        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.get(self.frontend_euralis_url)

                if response.status_code == 200:
                    self.print_result(
                        "Frontend Euralis",
                        "OK",
                        "Next.js application is running",
                        {"URL": self.frontend_euralis_url}
                    )
                    return True
                else:
                    self.print_result(
                        "Frontend Euralis",
                        "WARNING",
                        f"HTTP {response.status_code}"
                    )
                    return False

        except httpx.ConnectError:
            self.print_result(
                "Frontend Euralis",
                "FAILED",
                f"Cannot connect to {self.frontend_euralis_url}"
            )
            return False
        except Exception as e:
            self.print_result(
                "Frontend Euralis",
                "FAILED",
                f"Unexpected error: {str(e)}"
            )
            return False

    async def check_frontend_gaveurs(self) -> bool:
        """Check Frontend Gaveurs"""
        print(f"\n{Colors.BLUE}[6/7] Checking Frontend Gaveurs...{Colors.END}")

        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.get(self.frontend_gaveurs_url)

                if response.status_code == 200:
                    self.print_result(
                        "Frontend Gaveurs",
                        "OK",
                        "Next.js application is running",
                        {"URL": self.frontend_gaveurs_url}
                    )
                    return True
                else:
                    self.print_result(
                        "Frontend Gaveurs",
                        "WARNING",
                        f"HTTP {response.status_code}"
                    )
                    return False

        except httpx.ConnectError:
            self.print_result(
                "Frontend Gaveurs",
                "FAILED",
                f"Cannot connect to {self.frontend_gaveurs_url}"
            )
            return False
        except Exception as e:
            self.print_result(
                "Frontend Gaveurs",
                "FAILED",
                f"Unexpected error: {str(e)}"
            )
            return False

    async def check_frontend_sqal(self) -> bool:
        """Check Frontend SQAL"""
        print(f"\n{Colors.BLUE}[7/7] Checking Frontend SQAL...{Colors.END}")

        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.get(self.frontend_sqal_url)

                if response.status_code == 200:
                    self.print_result(
                        "Frontend SQAL",
                        "OK",
                        "Vite application is running",
                        {"URL": self.frontend_sqal_url}
                    )
                    return True
                else:
                    self.print_result(
                        "Frontend SQAL",
                        "WARNING",
                        f"HTTP {response.status_code}"
                    )
                    return False

        except httpx.ConnectError:
            self.print_result(
                "Frontend SQAL",
                "FAILED",
                f"Cannot connect to {self.frontend_sqal_url}"
            )
            return False
        except Exception as e:
            self.print_result(
                "Frontend SQAL",
                "FAILED",
                f"Unexpected error: {str(e)}"
            )
            return False

    def print_summary(self):
        """Print summary of health check"""
        print(f"\n{Colors.CYAN}{'='*70}{Colors.END}")
        print(f"{Colors.BOLD}Health Check Summary{Colors.END}")
        print(f"{Colors.CYAN}{'='*70}{Colors.END}\n")

        ok_count = sum(1 for r in self.results if r["status"] == "OK")
        warning_count = sum(1 for r in self.results if r["status"] == "WARNING")
        failed_count = sum(1 for r in self.results if r["status"] == "FAILED")

        total = len(self.results)

        print(f"Total checks: {total}")
        print(f"{Colors.GREEN}✓ Passed:  {ok_count}{Colors.END}")
        print(f"{Colors.YELLOW}⚠ Warning: {warning_count}{Colors.END}")
        print(f"{Colors.RED}✗ Failed:  {failed_count}{Colors.END}\n")

        if failed_count == 0 and warning_count == 0:
            print(f"{Colors.GREEN}{Colors.BOLD}✅ ALL SYSTEMS OPERATIONAL{Colors.END}\n")
            return 0
        elif failed_count == 0:
            print(f"{Colors.YELLOW}{Colors.BOLD}⚠️  SYSTEM OPERATIONAL WITH WARNINGS{Colors.END}\n")
            return 1
        else:
            print(f"{Colors.RED}{Colors.BOLD}❌ SYSTEM HAS FAILURES{Colors.END}\n")
            return 2

    async def run_all_checks(self) -> int:
        """Run all health checks"""
        self.print_header()

        # Run checks sequentially
        await self.check_database()
        await self.check_backend()
        await self.check_api_endpoints()
        await self.check_websockets()
        await self.check_frontend_euralis()
        await self.check_frontend_gaveurs()
        await self.check_frontend_sqal()

        # Print summary
        return self.print_summary()


async def main():
    """Main entry point"""
    checker = HealthChecker()
    exit_code = await checker.run_all_checks()
    sys.exit(exit_code)


if __name__ == "__main__":
    asyncio.run(main())
