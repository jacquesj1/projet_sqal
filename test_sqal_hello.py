import asyncio
import websockets
import json

async def test_hello():
    uri = "ws://localhost:8000/ws/sensors/"
    print(f"Connecting to {uri}...")
    try:
        async with websockets.connect(uri) as websocket:
            print("Connected! Sending HELLO message...")

            # Send HELLO like the real simulator
            hello_msg = {
                "type": "esp32_hello",
                "device_id": "ESP32-TEST-001",
                "timestamp": "2026-01-05T14:00:00Z",
                "firmware_version": "1.0.0"
            }

            await websocket.send(json.dumps(hello_msg))
            print(f"Sent HELLO: {hello_msg}")

            # Wait for response
            response = await asyncio.wait_for(websocket.recv(), timeout=5.0)
            print(f"\nReceived response ({len(response)} bytes):")
            print(response[:500])  # Print first 500 chars

            # Try to parse as JSON
            try:
                resp_json = json.loads(response)
                print(f"\nParsed JSON:")
                print(json.dumps(resp_json, indent=2))
            except:
                print("Response is not JSON")

    except Exception as e:
        print(f"ERROR: {e}")

if __name__ == "__main__":
    asyncio.run(test_hello())
