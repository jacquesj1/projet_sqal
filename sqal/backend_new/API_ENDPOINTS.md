# SQAL Backend API Endpoints

## Overview
This document describes all API endpoints available in the SQAL backend system.

## Base URL
```
http://localhost:8000
```

## Authentication
Most endpoints require authentication using Bearer tokens:
```
Authorization: Bearer <token>
```

---

## AI/ML Endpoints (`/api/ai`)

### Models
- `GET /api/ai/models/` - List all AI models
- `GET /api/ai/models/{model_id}` - Get specific model
- `POST /api/ai/models/` - Create new model
- `PATCH /api/ai/models/{model_id}` - Update model
- `DELETE /api/ai/models/{model_id}` - Delete model
- `POST /api/ai/models/{model_id}/activate/` - Activate model
- `POST /api/ai/models/{model_id}/deactivate/` - Deactivate model

### Training
- `GET /api/ai/training/` - List training jobs
- `POST /api/ai/training/` - Create training job
- `GET /api/ai/training/{job_id}` - Get training job details

### Datasets
- `GET /api/ai/datasets/` - List datasets
- `POST /api/ai/datasets/` - Create dataset

### Predictions
- `POST /api/ai/predict/` - Make prediction

### Metrics
- `GET /api/ai/metrics/` - Get AI metrics

---

## Firmware & OTA Endpoints (`/api/firmware`)

### Firmware Versions
- `GET /api/firmware/versions/` - List firmware versions
- `GET /api/firmware/versions/{version_id}` - Get version details
- `POST /api/firmware/versions/` - Upload new firmware version
- `DELETE /api/firmware/versions/{version_id}` - Delete version

### OTA Updates
- `GET /api/firmware/ota/` - List OTA updates
- `GET /api/firmware/ota/{update_id}` - Get update details
- `POST /api/firmware/ota/` - Create OTA update campaign
- `POST /api/firmware/ota/{update_id}/cancel/` - Cancel OTA update

---

## Bug Tracking Endpoints (`/api/bugs`)

### Bug Reports
- `GET /api/bugs/` - List bug reports (with filters)
  - Query params: `status`, `severity`, `skip`, `limit`
- `GET /api/bugs/{bug_id}` - Get bug details
- `POST /api/bugs/` - Create bug report
- `PATCH /api/bugs/{bug_id}` - Update bug report

### Comments
- `POST /api/bugs/{bug_id}/comments/` - Add comment to bug

### Metrics
- `GET /api/bugs/metrics/summary/` - Get bug tracking metrics

---

## Admin Endpoints (`/api/admin`)

### Users
- `GET /api/admin/users/` - List users
- `GET /api/admin/users/{user_id}` - Get user details
- `POST /api/admin/users/` - Create user
- `PATCH /api/admin/users/{user_id}` - Update user
- `DELETE /api/admin/users/{user_id}` - Delete user

### Devices
- `GET /api/admin/devices/` - List devices
- `GET /api/admin/devices/{device_id}` - Get device details
- `PATCH /api/admin/devices/{device_id}` - Update device
- `DELETE /api/admin/devices/{device_id}` - Delete device

### Audit Logs
- `GET /api/admin/audit/` - List audit logs
  - Query params: `action`, `resource_type`, `skip`, `limit`

### Settings
- `GET /api/admin/settings/` - Get system settings
- `PATCH /api/admin/settings/` - Update settings

---

## Reports Endpoints (`/api/reports`)

### Reports
- `GET /api/reports/` - List reports
- `GET /api/reports/{report_id}` - Get report details
- `POST /api/reports/` - Create report
- `DELETE /api/reports/{report_id}` - Delete report

### Scheduled Reports
- `GET /api/reports/scheduled/` - List scheduled reports
- `POST /api/reports/scheduled/` - Create scheduled report
- `PATCH /api/reports/scheduled/{report_id}` - Update scheduled report
- `DELETE /api/reports/scheduled/{report_id}` - Delete scheduled report

### Templates
- `GET /api/reports/templates/` - List report templates
- `POST /api/reports/templates/` - Create template

---

## Analysis Endpoints (`/api/analysis`)

### History
- `GET /api/analysis/history/` - Get analysis history
  - Query params: `grade`, `device_id`, `start_date`, `end_date`, `skip`, `limit`
- `GET /api/analysis/history/{analysis_id}` - Get specific analysis

### Statistics
- `GET /api/analysis/stats/` - Get analysis statistics
- `GET /api/analysis/grade-distribution/` - Get grade distribution
- `GET /api/analysis/timeseries/` - Get time series data

---

## Sensors Endpoints (`/api/sensors`)

### Raw Data
- `GET /api/sensors/vl53l8ch/raw/` - Get VL53L8CH raw data
- `GET /api/sensors/as7341/raw/` - Get AS7341 raw data

### Fusion Results
- `GET /api/sensors/fusion/` - Get fusion results

### Devices
- `GET /api/sensors/devices/` - List sensor devices
- `GET /api/sensors/devices/{device_id}` - Get device details
- `PATCH /api/sensors/devices/{device_id}` - Update device

---

## Organizations Endpoints (`/api/organizations`)

- `GET /api/organizations/` - List organizations
- `GET /api/organizations/{org_id}` - Get organization details
- `POST /api/organizations/` - Create organization
- `PATCH /api/organizations/{org_id}` - Update organization
- `DELETE /api/organizations/{org_id}` - Delete organization

---

## Dashboard Endpoints (`/api/dashboard`)

- `GET /api/dashboard/metrics/` - Get dashboard metrics
- `GET /api/dashboard/foie-gras-metrics/` - Get foie gras metrics
- `GET /api/dashboard/foie-gras-alerts/` - Get foie gras alerts

---

## WebSocket Endpoints

### Real-time Data
- `WS /ws/sensors/` - Connect data generator (ESP32 simulator)
- `WS /ws/realtime/` - Connect frontend dashboard for real-time updates

---

## Response Formats

### Success Response
```json
{
  "data": {},
  "message": "Success"
}
```

### Error Response
```json
{
  "detail": "Error message"
}
```

### Paginated Response
```json
{
  "items": [],
  "pagination": {
    "totalItems": 100,
    "totalPages": 10,
    "currentPage": 1,
    "hasPrevious": false,
    "hasNext": true
  }
}
```

---

## New Features Added

### 1. OTA Firmware Updates
- Upload firmware versions
- Create OTA update campaigns
- Track update progress per device
- Support for gradual rollout strategies

### 2. Bug Tracking System
- Create and manage bug reports
- Track by severity (critical, high, medium, low)
- Add comments to bugs
- Assign bugs to team members
- Track resolution metrics

### 3. AI/ML Management
- Model registry and versioning
- Training job tracking
- Dataset management
- Real-time predictions

### 4. Enhanced Reporting
- Generate reports (PDF, Excel, CSV, JSON)
- Schedule recurring reports
- Custom report templates

### 5. User & Organization Management
- Multi-tenant support
- Role-based access control
- Audit logging for all actions
- Organization settings

---

## Development

### Running the Backend
```bash
cd backend_new
pip install -r requirements.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### Running Tests
```bash
pytest
```

### Database Migrations
The backend automatically creates tables and hypertables on startup.

---

## Database Models

### New Models Added
- `AIModel` - AI model registry
- `TrainingJob` - Training job tracking
- `Dataset` - Dataset management
- `Prediction` - ML prediction results
- `FirmwareVersion` - Firmware version registry
- `OTAUpdate` - OTA update campaigns
- `OTAUpdateLog` - Device-level OTA logs
- `BugReport` - Bug tracking
- `BugComment` - Bug comments
- `BugMetrics` - Bug statistics
- `User` - User accounts
- `Organization` - Organizations/companies
- `AuditLog` - Audit trail
- `Device` - Device registry
- `Report` - Generated reports
- `ScheduledReport` - Recurring reports
- `ReportTemplate` - Report templates

---

## Notes

- All timestamps are in ISO 8601 format (UTC)
- UUIDs are used for all primary keys
- Pagination defaults: `skip=0`, `limit=50`
- File uploads use `multipart/form-data`
- WebSocket messages use JSON format
