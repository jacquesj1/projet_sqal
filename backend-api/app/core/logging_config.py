"""
Logging Configuration with Daily Rotation and Module Separation

This module provides:
- Daily log rotation (one file per day)
- Separate log files per module (auth, api, websocket, database, etc.)
- Structured logging with timestamps, levels, and request IDs
- Automatic log archiving
- Configurable log levels per module
"""

import logging
import logging.handlers
import os
import re
import sys
from datetime import datetime
from pathlib import Path
from typing import Optional

# Log directory
LOG_DIR = Path(__file__).parent.parent.parent / "logs"
LOG_DIR.mkdir(exist_ok=True)

# Log format with timestamp, level, module, and message
LOG_FORMAT = "%(asctime)s | %(levelname)-8s | %(name)-30s | %(message)s"
DATE_FORMAT = "%Y-%m-%d %H:%M:%S"

# Log levels by environment
LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO").upper()


class RequestIdFilter(logging.Filter):
    """
    Add request_id to log records if available
    """
    def filter(self, record):
        if not hasattr(record, 'request_id'):
            record.request_id = '-'
        return True


def get_daily_rotating_handler(
    log_file: str,
    level: str = "INFO",
    backup_count: int = 30
) -> logging.handlers.TimedRotatingFileHandler:
    """
    Create a daily rotating file handler

    Args:
        log_file: Base name for log file (e.g., "auth.log")
        level: Log level (DEBUG, INFO, WARNING, ERROR, CRITICAL)
        backup_count: Number of daily backup files to keep (default: 30 days)

    Returns:
        Configured TimedRotatingFileHandler
    """
    log_path = LOG_DIR / log_file

    handler = logging.handlers.TimedRotatingFileHandler(
        filename=str(log_path),
        when='midnight',  # Rotate at midnight
        interval=1,       # Every day
        backupCount=backup_count,  # Keep last 30 days
        encoding='utf-8',
        delay=False,
        utc=False
    )

    # Custom suffix for rotated files: YYYY-MM-DD
    handler.suffix = "%Y-%m-%d"
    handler.extMatch = re.compile(r"^\d{4}-\d{2}-\d{2}$")

    handler.setLevel(level)
    handler.setFormatter(logging.Formatter(LOG_FORMAT, DATE_FORMAT))
    handler.addFilter(RequestIdFilter())

    return handler


def get_console_handler(level: str = "INFO") -> logging.StreamHandler:
    """
    Create a console handler for stdout

    Args:
        level: Log level

    Returns:
        Configured StreamHandler
    """
    handler = logging.StreamHandler(sys.stdout)
    handler.setLevel(level)
    handler.setFormatter(logging.Formatter(LOG_FORMAT, DATE_FORMAT))
    handler.addFilter(RequestIdFilter())

    return handler


def setup_logger(
    name: str,
    log_file: Optional[str] = None,
    level: str = "INFO",
    console: bool = True,
    backup_count: int = 30
) -> logging.Logger:
    """
    Setup a logger with daily rotation and optional console output

    Args:
        name: Logger name (usually module name)
        log_file: Log file name (if None, uses name + ".log")
        level: Log level
        console: Whether to also log to console
        backup_count: Number of daily backups to keep

    Returns:
        Configured logger

    Example:
        logger = setup_logger("auth", level="DEBUG")
        logger.info("User logged in", extra={"request_id": "abc123"})
    """
    logger = logging.getLogger(name)
    logger.setLevel(level)

    # Avoid duplicate handlers if logger already configured
    if logger.handlers:
        return logger

    # File handler with daily rotation
    if log_file is None:
        log_file = f"{name.replace('.', '_')}.log"

    file_handler = get_daily_rotating_handler(log_file, level, backup_count)
    logger.addHandler(file_handler)

    # Console handler
    if console:
        console_handler = get_console_handler(level)
        logger.addHandler(console_handler)

    # Don't propagate to root logger
    logger.propagate = False

    return logger


def setup_application_loggers():
    """
    Setup all application loggers with module-specific files

    Log files created:
        - main.log           - Main application logs
        - auth.log           - Authentication/authorization
        - api.log            - API requests/responses
        - websocket.log      - WebSocket connections/messages
        - database.log       - Database queries/connections
        - cache.log          - Redis cache operations
        - ml.log             - Machine learning operations
        - blockchain.log     - Blockchain transactions
        - audit.log          - Security audit trail
        - errors.log         - Errors only (WARNING and above)
    """

    # Application level
    app_level = os.getenv("APP_LOG_LEVEL", LOG_LEVEL)

    loggers = {
        # Main application
        "main": setup_logger("main", "main.log", app_level, console=True),
        "uvicorn": setup_logger("uvicorn", "main.log", app_level, console=True),
        "uvicorn.access": setup_logger("uvicorn.access", "api.log", "INFO", console=False),
        "uvicorn.error": setup_logger("uvicorn.error", "errors.log", "WARNING", console=True),

        # Authentication & Security
        "auth": setup_logger("auth", "auth.log", "INFO", console=True),
        "audit": setup_logger("audit", "audit.log", "INFO", console=False),
        "app.auth.keycloak": setup_logger("app.auth.keycloak", "auth.log", "INFO", console=False),
        "app.auth.security_middleware": setup_logger("app.auth.security_middleware", "auth.log", "INFO", console=False),

        # API
        "api": setup_logger("api", "api.log", "INFO", console=False),
        "app.routers": setup_logger("app.routers", "api.log", "INFO", console=False),
        "app.routers.euralis": setup_logger("app.routers.euralis", "api.log", "INFO", console=False),
        "app.routers.sqal": setup_logger("app.routers.sqal", "api.log", "INFO", console=False),
        "app.routers.consumer_feedback": setup_logger("app.routers.consumer_feedback", "api.log", "INFO", console=False),

        # WebSocket
        "websocket": setup_logger("websocket", "websocket.log", "INFO", console=True),
        "app.websocket": setup_logger("app.websocket", "websocket.log", "INFO", console=False),

        # Database
        "database": setup_logger("database", "database.log", "INFO", console=False),
        "app.services": setup_logger("app.services", "database.log", "INFO", console=True),

        # Cache
        "cache": setup_logger("cache", "cache.log", "INFO", console=False),
        "app.core.cache": setup_logger("app.core.cache", "cache.log", "INFO", console=False),

        # Machine Learning
        "ml": setup_logger("ml", "ml.log", "INFO", console=False),
        "app.ml": setup_logger("app.ml", "ml.log", "INFO", console=False),

        # Blockchain
        "blockchain": setup_logger("blockchain", "blockchain.log", "INFO", console=False),
        "app.blockchain": setup_logger("app.blockchain", "blockchain.log", "INFO", console=False),

        # Core modules
        "app.core.health": setup_logger("app.core.health", "main.log", "INFO", console=False),
        "app.core.metrics": setup_logger("app.core.metrics", "main.log", "INFO", console=False),
        "app.core.graceful_shutdown": setup_logger("app.core.graceful_shutdown", "main.log", "INFO", console=False),

        # Errors only (WARNING and above)
        "errors": setup_logger("errors", "errors.log", "WARNING", console=True, backup_count=90),
    }

    # Configure root logger to catch everything else
    root_logger = logging.getLogger()
    root_logger.setLevel(LOG_LEVEL)

    # Add file handler to root logger for catching uncaught logs
    if not root_logger.handlers:
        root_handler = get_daily_rotating_handler("main.log", LOG_LEVEL)
        root_logger.addHandler(root_handler)

    return loggers


def get_logger(name: str) -> logging.Logger:
    """
    Get a logger by name

    Args:
        name: Logger name (e.g., "auth", "api", "websocket")

    Returns:
        Logger instance

    Example:
        from app.core.logging_config import get_logger
        logger = get_logger("auth")
        logger.info("User authenticated")
    """
    return logging.getLogger(name)


def log_with_context(logger: logging.Logger, level: str, message: str, **context):
    """
    Log with additional context

    Args:
        logger: Logger instance
        level: Log level (info, debug, warning, error, critical)
        message: Log message
        **context: Additional context (request_id, user_id, etc.)

    Example:
        log_with_context(
            logger, "info", "User logged in",
            request_id="abc123",
            user_id=42,
            ip="192.168.1.1"
        )
    """
    log_method = getattr(logger, level.lower())

    # Format context as key=value pairs
    context_str = " | ".join(f"{k}={v}" for k, v in context.items())
    full_message = f"{message} | {context_str}" if context else message

    log_method(full_message, extra=context)


# Initialize loggers on import
APPLICATION_LOGGERS = setup_application_loggers()


# Export commonly used loggers
main_logger = get_logger("main")
auth_logger = get_logger("auth")
audit_logger = get_logger("audit")
api_logger = get_logger("api")
websocket_logger = get_logger("websocket")
database_logger = get_logger("database")
cache_logger = get_logger("cache")
ml_logger = get_logger("ml")
blockchain_logger = get_logger("blockchain")
error_logger = get_logger("errors")


if __name__ == "__main__":
    # Test logging
    print(f"📁 Logs directory: {LOG_DIR}")
    print(f"📝 Log format: {LOG_FORMAT}")
    print(f"📊 Log level: {LOG_LEVEL}")
    print("")

    # Test each logger
    main_logger.info("✅ Main application started")
    auth_logger.info("🔐 Authentication module initialized")
    audit_logger.info("📝 Security audit log entry")
    api_logger.info("🌐 API request received")
    websocket_logger.info("🔌 WebSocket connection established")
    database_logger.info("💾 Database query executed")
    cache_logger.info("⚡ Cache hit")
    ml_logger.info("🤖 ML model prediction")
    blockchain_logger.info("⛓️  Blockchain transaction")
    error_logger.error("❌ Sample error message")

    print("")
    print("✅ Log files created in logs/ directory")
    print("📋 Files created:")
    for log_file in sorted(LOG_DIR.glob("*.log")):
        print(f"   - {log_file.name}")
