"""Test pour voir l'erreur exacte du backend"""
import asyncio
import websockets
import json

async def test():
    uri = "ws://localhost:8000/ws/sensors/"

    async with websockets.connect(uri) as websocket:
        # Receive connection message
        conn_msg = await websocket.recv()
        print(f"[OK] Connected: {conn_msg[:100]}...")

        # Send HELLO
        await websocket.send(json.dumps({
            "type": "esp32_hello",
            "device_id": "TEST",
            "timestamp": "2026-01-06T12:00:00Z",
            "firmware_version": "1.0.0"
        }))

        # Receive HELLO_ACK
        ack = await websocket.recv()
        print(f"[OK] ACK: {ack[:100]}...")

        # Send minimal sensor_data message
        payload = {
            "type": "sensor_data",
            "sample_id": "TEST-001",
            "device_id": "TEST",
            "timestamp": "2026-01-06T12:00:00Z",
            "vl53l8ch": {
                "distance_matrix": [[100]*8 for _ in range(8)],
                "reflectance_matrix": [[150]*8 for _ in range(8)],
                "amplitude_matrix": [[100]*8 for _ in range(8)],
                "quality_score": 0.85,
                "volume_mm3": 500000.0,
                "surface_uniformity": 0.9,
                "grade": "A+"
            },
            "as7341": {
                "channels": {
                    "F1_415nm": 1000,
                    "F2_445nm": 1200,
                    "F3_480nm": 1500,
                    "F4_515nm": 1800,
                    "F5_555nm": 2000,
                    "F6_590nm": 1700,
                    "F7_630nm": 1400,
                    "F8_680nm": 1100,
                    "Clear": 5000,
                    "NIR": 800
                },
                "freshness_index": 0.9,
                "fat_quality_index": 0.85,
                "oxidation_index": 0.05,
                "quality_score": 0.88
            },
            "fusion": {
                "final_score": 0.86,
                "final_grade": "A+",
                "is_compliant": True
            }
        }

        await websocket.send(json.dumps(payload))
        print(f"[SEND] Sent minimal payload")

        # Receive response
        response = await asyncio.wait_for(websocket.recv(), timeout=5.0)

        # Try to parse and pretty print
        try:
            resp_json = json.loads(response)
            print(f"\n[RECV] Response type: {resp_json.get('type')}")

            if resp_json.get('type') == 'error':
                print(f"\n[ERROR] ERROR MESSAGE:")
                print(f"Error: {resp_json.get('error')}")

                # Print data if available
                if 'data' in resp_json:
                    print(f"\nData keys: {list(resp_json['data'].keys())}")
            else:
                print(f"\n[SUCCESS] SUCCESS: {json.dumps(resp_json, indent=2)}")
        except Exception as e:
            print(f"\nCouldn't parse response: {e}")
            print(f"Raw: {response[:500]}...")

if __name__ == "__main__":
    asyncio.run(test())
