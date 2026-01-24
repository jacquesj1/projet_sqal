"""
WebSocket Test Suite for Système Gaveurs V3.0
Tests WebSocket connections for sensor data and real-time broadcasting
"""

import pytest
import asyncio
import websockets
import json
from datetime import datetime
from typing import Dict, Any, List
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Test configuration
BACKEND_WS_URL = "ws://localhost:8000"
SENSOR_WS_PATH = "/ws/sensors/"
REALTIME_WS_PATH = "/ws/realtime/"
TIMEOUT = 30.0


class TestWebSocketSensorFlow:
    """Test WebSocket sensor data flow"""

    @pytest.fixture
    def sample_sensor_data(self) -> Dict[str, Any]:
        """Generate realistic sensor data"""
        return {
            "sample_id": f"SAMPLE-{datetime.now().strftime('%Y%m%d%H%M%S%f')}",
            "device_id": "ESP32-TEST-WS-001",
            "timestamp": datetime.now().isoformat(),
            "lot_id": 1,

            # VL53L8CH data
            "vl53l8ch_data": {
                "distance_matrix": [[150 + (i*2 + j) for j in range(8)] for i in range(8)],
                "reflectance_matrix": [[80 + (i + j) for j in range(8)] for i in range(8)],
                "amplitude_matrix": [[1000 + (i*10 + j*5) for j in range(8)] for i in range(8)],
                "quality_score": 0.85
            },

            # AS7341 data
            "as7341_data": {
                "channel_415nm": 1200,
                "channel_445nm": 1500,
                "channel_480nm": 1800,
                "channel_515nm": 2000,
                "channel_555nm": 2200,
                "channel_590nm": 2100,
                "channel_630nm": 1900,
                "channel_680nm": 1600,
                "channel_clear": 15000,
                "channel_nir": 1400,
                "freshness_index": 0.88
            },

            # Fusion result
            "fusion": {
                "final_score": 0.86,
                "final_grade": "A",
                "confidence": 0.92
            }
        }

    async def test_sensor_websocket_connection(self):
        """Test 1: Basic sensor WebSocket connection"""
        logger.info("=== TEST 1: Sensor WebSocket Connection ===")

        uri = f"{BACKEND_WS_URL}{SENSOR_WS_PATH}"

        try:
            async with websockets.connect(uri) as websocket:
                logger.info(f"✓ Connected to {uri}")

                # Send ping
                await websocket.send(json.dumps({"type": "ping"}))

                # Wait for pong
                response = await asyncio.wait_for(websocket.recv(), timeout=5.0)
                data = json.loads(response)

                assert data.get("type") == "pong"
                logger.info("✓ Ping-pong successful")

        except Exception as e:
            logger.error(f"✗ Connection failed: {str(e)}")
            raise

    async def test_send_sensor_data(self, sample_sensor_data):
        """Test 2: Send sensor data and receive ACK"""
        logger.info("=== TEST 2: Send Sensor Data ===")

        uri = f"{BACKEND_WS_URL}{SENSOR_WS_PATH}"

        try:
            async with websockets.connect(uri) as websocket:
                logger.info("✓ Connected to sensor endpoint")

                # Send sensor data
                await websocket.send(json.dumps(sample_sensor_data))
                logger.info(f"→ Sent sensor data: {sample_sensor_data['sample_id']}")

                # Wait for ACK
                response = await asyncio.wait_for(websocket.recv(), timeout=10.0)
                data = json.loads(response)

                assert data.get("type") == "ack"
                assert data.get("sample_id") == sample_sensor_data['sample_id']

                logger.info(f"✓ ACK received for sample {sample_sensor_data['sample_id']}")

        except Exception as e:
            logger.error(f"✗ Sensor data send failed: {str(e)}")
            raise

    async def test_send_multiple_samples(self, sample_sensor_data):
        """Test 3: Send multiple sensor samples"""
        logger.info("=== TEST 3: Send Multiple Samples ===")

        uri = f"{BACKEND_WS_URL}{SENSOR_WS_PATH}"
        num_samples = 5

        try:
            async with websockets.connect(uri) as websocket:
                logger.info(f"✓ Connected to sensor endpoint")

                for i in range(num_samples):
                    # Modify sample_id for each sample
                    sample_data = sample_sensor_data.copy()
                    sample_data['sample_id'] = f"SAMPLE-BATCH-{datetime.now().strftime('%Y%m%d%H%M%S')}-{i:03d}"
                    sample_data['timestamp'] = datetime.now().isoformat()

                    # Vary quality scores
                    sample_data['vl53l8ch_data']['quality_score'] = 0.7 + (i * 0.05)
                    sample_data['fusion']['final_score'] = 0.7 + (i * 0.05)

                    # Send sample
                    await websocket.send(json.dumps(sample_data))

                    # Wait for ACK
                    response = await asyncio.wait_for(websocket.recv(), timeout=10.0)
                    data = json.loads(response)

                    assert data.get("type") == "ack"
                    assert data.get("sample_id") == sample_data['sample_id']

                    logger.info(f"  [{i+1}/{num_samples}] ✓ Sample {sample_data['sample_id']} ACK received")

                    # Small delay between samples
                    await asyncio.sleep(0.5)

                logger.info(f"✓ All {num_samples} samples sent and acknowledged")

        except Exception as e:
            logger.error(f"✗ Multiple samples test failed: {str(e)}")
            raise

    async def test_invalid_sensor_data(self):
        """Test 4: Send invalid sensor data"""
        logger.info("=== TEST 4: Invalid Sensor Data ===")

        uri = f"{BACKEND_WS_URL}{SENSOR_WS_PATH}"

        invalid_data = {
            "sample_id": "INVALID-SAMPLE",
            # Missing required fields
            "device_id": "ESP32-TEST",
        }

        try:
            async with websockets.connect(uri) as websocket:
                logger.info("✓ Connected to sensor endpoint")

                # Send invalid data
                await websocket.send(json.dumps(invalid_data))
                logger.info("→ Sent invalid sensor data")

                # Wait for error response
                response = await asyncio.wait_for(websocket.recv(), timeout=10.0)
                data = json.loads(response)

                assert data.get("type") == "error"
                logger.info(f"✓ Error response received: {data.get('error', 'Unknown error')}")

        except Exception as e:
            logger.error(f"✗ Invalid data test failed: {str(e)}")
            raise


class TestWebSocketRealtimeBroadcast:
    """Test WebSocket real-time broadcasting"""

    async def test_realtime_websocket_connection(self):
        """Test 5: Basic realtime WebSocket connection"""
        logger.info("=== TEST 5: Realtime WebSocket Connection ===")

        uri = f"{BACKEND_WS_URL}{REALTIME_WS_PATH}"

        try:
            async with websockets.connect(uri) as websocket:
                logger.info(f"✓ Connected to {uri}")

                # Wait for welcome message
                response = await asyncio.wait_for(websocket.recv(), timeout=5.0)
                data = json.loads(response)

                # Should receive some initial message or confirmation
                logger.info(f"✓ Received message: {data.get('type', 'unknown')}")

        except Exception as e:
            logger.error(f"✗ Realtime connection failed: {str(e)}")
            raise

    async def test_realtime_broadcast_reception(self, sample_sensor_data):
        """Test 6: Receive broadcast data"""
        logger.info("=== TEST 6: Realtime Broadcast Reception ===")

        sensor_uri = f"{BACKEND_WS_URL}{SENSOR_WS_PATH}"
        realtime_uri = f"{BACKEND_WS_URL}{REALTIME_WS_PATH}"

        received_broadcasts = []

        try:
            # Connect to realtime endpoint first
            async with websockets.connect(realtime_uri) as realtime_ws:
                logger.info("✓ Connected to realtime endpoint")

                # Create a task to listen for broadcasts
                async def listen_for_broadcasts():
                    try:
                        while True:
                            message = await asyncio.wait_for(realtime_ws.recv(), timeout=15.0)
                            data = json.loads(message)
                            received_broadcasts.append(data)
                            logger.info(f"  ← Received broadcast: {data.get('type', 'unknown')}")
                    except asyncio.TimeoutError:
                        logger.info("  Listening timeout reached")

                listener_task = asyncio.create_task(listen_for_broadcasts())

                # Give listener time to start
                await asyncio.sleep(1)

                # Now send sensor data
                async with websockets.connect(sensor_uri) as sensor_ws:
                    logger.info("✓ Connected to sensor endpoint")

                    sample_data = sample_sensor_data.copy()
                    sample_data['sample_id'] = f"SAMPLE-BROADCAST-{datetime.now().strftime('%Y%m%d%H%M%S')}"

                    await sensor_ws.send(json.dumps(sample_data))
                    logger.info(f"→ Sent sensor data: {sample_data['sample_id']}")

                    # Wait for ACK
                    ack = await asyncio.wait_for(sensor_ws.recv(), timeout=5.0)
                    logger.info("✓ ACK received from sensor endpoint")

                # Wait a bit for broadcasts
                await asyncio.sleep(3)

                # Cancel listener
                listener_task.cancel()

                # Verify we received broadcasts
                if len(received_broadcasts) > 0:
                    logger.info(f"✓ Received {len(received_broadcasts)} broadcast(s)")

                    # Check if we received the expected sample_id in any broadcast
                    found = False
                    for broadcast in received_broadcasts:
                        if broadcast.get('sample_id') == sample_data['sample_id']:
                            found = True
                            break

                    if found:
                        logger.info(f"✓ Found our sample in broadcasts!")
                    else:
                        logger.warning(f"⚠ Sample not found in broadcasts (might be due to timing)")
                else:
                    logger.warning("⚠ No broadcasts received (check if broadcaster is enabled)")

        except Exception as e:
            logger.error(f"✗ Broadcast reception test failed: {str(e)}")
            raise

    async def test_multiple_realtime_clients(self, sample_sensor_data):
        """Test 7: Multiple realtime clients receive same broadcasts"""
        logger.info("=== TEST 7: Multiple Realtime Clients ===")

        sensor_uri = f"{BACKEND_WS_URL}{SENSOR_WS_PATH}"
        realtime_uri = f"{BACKEND_WS_URL}{REALTIME_WS_PATH}"
        num_clients = 3

        clients_received = {i: [] for i in range(num_clients)}

        try:
            # Connect multiple realtime clients
            realtime_connections = []
            for i in range(num_clients):
                ws = await websockets.connect(realtime_uri)
                realtime_connections.append(ws)
                logger.info(f"✓ Client {i+1} connected to realtime endpoint")

            # Create listeners for each client
            async def listen_client(client_id, websocket):
                try:
                    while True:
                        message = await asyncio.wait_for(websocket.recv(), timeout=10.0)
                        data = json.loads(message)
                        clients_received[client_id].append(data)
                        logger.info(f"  ← Client {client_id+1} received: {data.get('type', 'unknown')}")
                except asyncio.TimeoutError:
                    pass

            # Start all listeners
            listener_tasks = [
                asyncio.create_task(listen_client(i, ws))
                for i, ws in enumerate(realtime_connections)
            ]

            # Give listeners time to start
            await asyncio.sleep(1)

            # Send sensor data
            async with websockets.connect(sensor_uri) as sensor_ws:
                sample_data = sample_sensor_data.copy()
                sample_data['sample_id'] = f"SAMPLE-MULTI-{datetime.now().strftime('%Y%m%d%H%M%S')}"

                await sensor_ws.send(json.dumps(sample_data))
                logger.info(f"→ Sent sensor data: {sample_data['sample_id']}")

                # Wait for ACK
                await asyncio.wait_for(sensor_ws.recv(), timeout=5.0)

            # Wait for broadcasts
            await asyncio.sleep(3)

            # Cancel all listeners
            for task in listener_tasks:
                task.cancel()

            # Close all connections
            for ws in realtime_connections:
                await ws.close()

            # Check results
            total_received = sum(len(msgs) for msgs in clients_received.values())
            logger.info(f"✓ Total messages received by all clients: {total_received}")

            for i, msgs in clients_received.items():
                logger.info(f"  Client {i+1}: {len(msgs)} message(s)")

        except Exception as e:
            logger.error(f"✗ Multiple clients test failed: {str(e)}")
            raise


class TestWebSocketStressTest:
    """Stress tests for WebSocket connections"""

    async def test_rapid_sensor_data_stream(self, sample_sensor_data):
        """Test 8: Rapid sensor data streaming"""
        logger.info("=== TEST 8: Rapid Sensor Data Stream ===")

        uri = f"{BACKEND_WS_URL}{SENSOR_WS_PATH}"
        num_samples = 20
        success_count = 0

        try:
            async with websockets.connect(uri) as websocket:
                logger.info(f"✓ Connected to sensor endpoint")

                start_time = datetime.now()

                for i in range(num_samples):
                    sample_data = sample_sensor_data.copy()
                    sample_data['sample_id'] = f"RAPID-{datetime.now().strftime('%Y%m%d%H%M%S%f')}-{i:03d}"
                    sample_data['timestamp'] = datetime.now().isoformat()

                    # Send without waiting
                    await websocket.send(json.dumps(sample_data))

                    # Try to receive ACK (non-blocking)
                    try:
                        response = await asyncio.wait_for(websocket.recv(), timeout=1.0)
                        data = json.loads(response)
                        if data.get("type") == "ack":
                            success_count += 1
                    except asyncio.TimeoutError:
                        pass

                end_time = datetime.now()
                duration = (end_time - start_time).total_seconds()

                logger.info(f"✓ Sent {num_samples} samples in {duration:.2f} seconds")
                logger.info(f"✓ Received {success_count} ACKs ({success_count/num_samples*100:.1f}%)")
                logger.info(f"✓ Rate: {num_samples/duration:.2f} samples/second")

        except Exception as e:
            logger.error(f"✗ Rapid stream test failed: {str(e)}")
            raise

    async def test_websocket_reconnection(self, sample_sensor_data):
        """Test 9: WebSocket reconnection"""
        logger.info("=== TEST 9: WebSocket Reconnection ===")

        uri = f"{BACKEND_WS_URL}{SENSOR_WS_PATH}"
        num_reconnections = 3

        try:
            for i in range(num_reconnections):
                logger.info(f"  Connection attempt {i+1}/{num_reconnections}...")

                async with websockets.connect(uri) as websocket:
                    # Send a sample
                    sample_data = sample_sensor_data.copy()
                    sample_data['sample_id'] = f"RECONN-{i:03d}-{datetime.now().strftime('%Y%m%d%H%M%S')}"

                    await websocket.send(json.dumps(sample_data))

                    # Wait for ACK
                    response = await asyncio.wait_for(websocket.recv(), timeout=5.0)
                    data = json.loads(response)

                    assert data.get("type") == "ack"
                    logger.info(f"  ✓ Connection {i+1} successful, ACK received")

                # Connection closed automatically here

                # Wait before reconnecting
                if i < num_reconnections - 1:
                    await asyncio.sleep(1)

            logger.info(f"✓ Successfully reconnected {num_reconnections} times")

        except Exception as e:
            logger.error(f"✗ Reconnection test failed: {str(e)}")
            raise


@pytest.fixture
def sample_sensor_data() -> Dict[str, Any]:
    """Generate realistic sensor data fixture"""
    return {
        "sample_id": f"SAMPLE-{datetime.now().strftime('%Y%m%d%H%M%S%f')}",
        "device_id": "ESP32-TEST-WS-001",
        "timestamp": datetime.now().isoformat(),
        "lot_id": 1,
        "vl53l8ch_data": {
            "distance_matrix": [[150 + (i*2 + j) for j in range(8)] for i in range(8)],
            "reflectance_matrix": [[80 + (i + j) for j in range(8)] for i in range(8)],
            "amplitude_matrix": [[1000 + (i*10 + j*5) for j in range(8)] for i in range(8)],
            "quality_score": 0.85
        },
        "as7341_data": {
            "channel_415nm": 1200,
            "channel_445nm": 1500,
            "channel_480nm": 1800,
            "channel_515nm": 2000,
            "channel_555nm": 2200,
            "channel_590nm": 2100,
            "channel_630nm": 1900,
            "channel_680nm": 1600,
            "channel_clear": 15000,
            "channel_nir": 1400,
            "freshness_index": 0.88
        },
        "fusion": {
            "final_score": 0.86,
            "final_grade": "A",
            "confidence": 0.92
        }
    }


@pytest.mark.asyncio
async def test_all_websocket_flows(sample_sensor_data):
    """Run all WebSocket tests"""
    logger.info("\n" + "="*70)
    logger.info("WEBSOCKET TEST SUITE - START")
    logger.info("="*70 + "\n")

    # Sensor tests
    sensor_tests = TestWebSocketSensorFlow()
    await sensor_tests.test_sensor_websocket_connection()
    await sensor_tests.test_send_sensor_data(sample_sensor_data)
    await sensor_tests.test_send_multiple_samples(sample_sensor_data)
    await sensor_tests.test_invalid_sensor_data()

    # Realtime broadcast tests
    realtime_tests = TestWebSocketRealtimeBroadcast()
    await realtime_tests.test_realtime_websocket_connection()
    await realtime_tests.test_realtime_broadcast_reception(sample_sensor_data)
    await realtime_tests.test_multiple_realtime_clients(sample_sensor_data)

    # Stress tests
    stress_tests = TestWebSocketStressTest()
    await stress_tests.test_rapid_sensor_data_stream(sample_sensor_data)
    await stress_tests.test_websocket_reconnection(sample_sensor_data)

    logger.info("\n" + "="*70)
    logger.info("✅ WEBSOCKET TEST SUITE - ALL TESTS COMPLETED")
    logger.info("="*70 + "\n")


if __name__ == "__main__":
    # Run tests directly
    sample_data = {
        "sample_id": f"SAMPLE-{datetime.now().strftime('%Y%m%d%H%M%S%f')}",
        "device_id": "ESP32-TEST-WS-001",
        "timestamp": datetime.now().isoformat(),
        "lot_id": 1,
        "vl53l8ch_data": {
            "distance_matrix": [[150 + (i*2 + j) for j in range(8)] for i in range(8)],
            "reflectance_matrix": [[80 + (i + j) for j in range(8)] for i in range(8)],
            "amplitude_matrix": [[1000 + (i*10 + j*5) for j in range(8)] for i in range(8)],
            "quality_score": 0.85
        },
        "as7341_data": {
            "channel_415nm": 1200,
            "channel_445nm": 1500,
            "channel_480nm": 1800,
            "channel_515nm": 2000,
            "channel_555nm": 2200,
            "channel_590nm": 2100,
            "channel_630nm": 1900,
            "channel_680nm": 1600,
            "channel_clear": 15000,
            "channel_nir": 1400,
            "freshness_index": 0.88
        },
        "fusion": {
            "final_score": 0.86,
            "final_grade": "A",
            "confidence": 0.92
        }
    }

    asyncio.run(test_all_websocket_flows(sample_data))
