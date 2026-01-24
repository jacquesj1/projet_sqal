import asyncio
import websockets
import json
from datetime import datetime

async def test_sensor_data():
    uri = "ws://localhost:8000/ws/sensors/"
    print(f"Connecting to {uri}...")
    try:
        async with websockets.connect(uri) as websocket:
            print("Connected!")

            # 1. Receive connection_established message first
            conn_msg = await asyncio.wait_for(websocket.recv(), timeout=5.0)
            print(f"Connection message: {conn_msg[:150]}")

            # 2. Send a minimal sensor data message (like the real simulator does)
            sensor_msg = {
                "type": "sensor_data",
                "sample_id": "TEST-001",
                "device_id": "ESP32-TEST-001",
                "timestamp": datetime.now().isoformat(),
                "tof": {
                    "zone_0": [100] * 64  # 8x8 matrix
                },
                "spectral": {
                    "F1_415nm": 1000,
                    "F2_445nm": 1100,
                    "F3_480nm": 1200,
                    "F4_515nm": 1300,
                    "F5_555nm": 1400,
                    "F6_590nm": 1500,
                    "F7_630nm": 1600,
                    "F8_680nm": 1700,
                    "NIR": 1800,
                    "Clear": 2000
                },
                "fusion": {
                    "final_grade": "A",
                    "confidence": 0.95
                }
            }

            await websocket.send(json.dumps(sensor_msg))
            print(f"Sent sensor data")

            # Wait for response
            try:
                response = await asyncio.wait_for(websocket.recv(), timeout=3.0)
                print(f"\nReceived response ({len(response)} bytes):")
                if len(response) > 1000:
                    print(response[:500] + "\n... (truncated) ...\n" + response[-500:])
                else:
                    print(response)

                # Try to parse as JSON
                try:
                    resp_json = json.loads(response)
                    print(f"\nParsed JSON type: {resp_json.get('type')}")
                    if resp_json.get('type') == 'error':
                        print(f"ERROR MESSAGE: {resp_json.get('message')}")
                        print(f"DETAILS: {resp_json.get('details')}")
                except:
                    print("Response is not JSON")
            except asyncio.TimeoutError:
                print("No response received (timeout)")

    except Exception as e:
        print(f"ERROR: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(test_sensor_data())
