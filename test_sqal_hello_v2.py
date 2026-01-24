import asyncio
import websockets
import json

async def test_hello():
    uri = "ws://localhost:8000/ws/sensors/"
    print(f"Connecting to {uri}...")
    try:
        async with websockets.connect(uri) as websocket:
            print("Connected!")

            # 1. Receive connection_established message
            conn_msg = await asyncio.wait_for(websocket.recv(), timeout=5.0)
            print(f"\n[1] Connection message: {conn_msg[:200]}")

            # 2. Send HELLO
            hello_msg = {
                "type": "esp32_hello",
                "device_id": "ESP32-TEST-001",
                "timestamp": "2026-01-05T14:00:00Z",
                "firmware_version": "1.0.0"
            }
            await websocket.send(json.dumps(hello_msg))
            print(f"\n[2] Sent HELLO: {hello_msg}")

            # 3. Wait for HELLO_ACK response
            hello_ack = await asyncio.wait_for(websocket.recv(), timeout=5.0)
            print(f"\n[3] HELLO_ACK response ({len(hello_ack)} bytes):")
            print(hello_ack)

            # Try to parse as JSON
            try:
                resp_json = json.loads(hello_ack)
                print(f"\nParsed JSON:")
                print(json.dumps(resp_json, indent=2))

                if resp_json.get('type') == 'hello_ack':
                    print("\n✅ SUCCESS! Backend correctly handled HELLO message")
                else:
                    print(f"\n❌ FAIL! Expected 'hello_ack', got '{resp_json.get('type')}'")
            except:
                print("Response is not JSON")

    except Exception as e:
        print(f"ERROR: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(test_hello())
