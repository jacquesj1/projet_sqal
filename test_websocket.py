import asyncio
import websockets
import json

async def test_websocket():
    uri = "ws://localhost:8000/ws/sensors/"
    print(f"Connecting to {uri}...")
    try:
        async with websockets.connect(uri) as websocket:
            print("OK Connected successfully!")

            # Send a test message
            test_data = {
                "device_id": "TEST-001",
                "timestamp": "2026-01-04T12:00:00Z",
                "test": True
            }
            await websocket.send(json.dumps(test_data))
            print(f"OK Sent test data")

            # Wait a bit
            await asyncio.sleep(2)
            print("OK Connection stable")

    except Exception as e:
        print(f"ERROR Connection failed: {e}")

if __name__ == "__main__":
    asyncio.run(test_websocket())
