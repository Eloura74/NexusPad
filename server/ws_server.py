#!/usr/bin/env python3
import asyncio
import json
import time
from typing import Dict, Set, Any, Optional

import websockets
from websockets.legacy.server import WebSocketServerProtocol

PORT = 8765
PC_TTL_SECONDS = 7.0
BROADCAST_EVERY_SECONDS = 1.0

ui_clients: Set[WebSocketServerProtocol] = set()
pc_clients: Set[WebSocketServerProtocol] = set()

pc_last_seen: Dict[str, float] = {}                      # host -> ts
pc_host_to_ws: Dict[str, WebSocketServerProtocol] = {}   # host -> ws
pc_ws_to_host: Dict[WebSocketServerProtocol, str] = {}   # ws -> host


def now() -> float:
    return time.time()


def log(*a):
    print(*a, flush=True)


def current_hosts() -> list[str]:
    cutoff = now() - PC_TTL_SECONDS
    return sorted([h for h, t in pc_last_seen.items() if t >= cutoff])


def current_status() -> Dict[str, Any]:
    hosts = current_hosts()
    return {"type": "status", "online": bool(hosts), "hosts": hosts, "ts": now()}


async def safe_send_raw(ws: WebSocketServerProtocol, msg: str) -> bool:
    try:
        await ws.send(msg)
        return True
    except Exception:
        return False


async def safe_send(ws: WebSocketServerProtocol, payload: Dict[str, Any]) -> bool:
    return await safe_send_raw(ws, json.dumps(payload))


async def broadcast_ui(payload: Dict[str, Any]) -> None:
    if not ui_clients:
        return
    msg = json.dumps(payload)
    dead = []
    for ws in ui_clients:
        if not await safe_send_raw(ws, msg):
            dead.append(ws)
    for ws in dead:
        ui_clients.discard(ws)


async def send_to_pc(host: str, payload: Dict[str, Any]) -> bool:
    ws = pc_host_to_ws.get(host)
    if not ws:
        return False
    return await safe_send_raw(ws, json.dumps(payload))


async def broadcaster_loop() -> None:
    while True:
        st = current_status()
        await broadcast_ui(st)
        await asyncio.sleep(BROADCAST_EVERY_SECONDS)


def normalize_cmd(msg: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    if msg.get("type") != "cmd":
        return None

    # Nouveau format action -> legacy
    if isinstance(msg.get("action"), dict) and "cmd" not in msg:
        a = msg["action"]
        a_type = a.get("type")
        payload = a.get("payload")

        if a_type == "hotkey":
            return {"type": "cmd", "cmd": "keys", "keys": str(payload or "")}
        if a_type == "shell":
            return {"type": "cmd", "cmd": "shell", "command": str(payload or "")}
        if a_type == "run" and isinstance(payload, dict):
            return {
                "type": "cmd",
                "cmd": "run",
                "path": payload.get("path", ""),
                "args": payload.get("args", []),
            }
        return None

    # Legacy direct
    if not isinstance(msg.get("cmd"), str):
        return None

    return msg


def pick_default_target() -> Optional[str]:
    hosts = current_hosts()
    return hosts[0] if hosts else None


async def handle_client(ws: WebSocketServerProtocol) -> None:
    client_type: Optional[str] = None
    bound_host: Optional[str] = None
    peer = None

    try:
        try:
            peer = ws.remote_address
        except Exception:
            peer = None

        async for raw in ws:
            try:
                msg = json.loads(raw)
            except Exception:
                continue
            if not isinstance(msg, dict):
                continue

            # HELLO
            if msg.get("type") == "hello":
                client_type = msg.get("client")

                if client_type == "ui":
                    ui_clients.add(ws)
                    log(f"[UI] hello from {peer} (ui_clients={len(ui_clients)})")
                    await safe_send(ws, current_status())
                    continue

                if client_type == "pc":
                    pc_clients.add(ws)
                    host = msg.get("host")
                    if isinstance(host, str) and host:
                        bound_host = host
                        pc_ws_to_host[ws] = host
                        pc_host_to_ws[host] = ws
                        pc_last_seen[host] = now()
                        log(f"[PC] hello host={host} from {peer} (pc_clients={len(pc_clients)})")
                        await broadcast_ui(current_status())
                    continue

                await safe_send(ws, {"type": "error", "message": "hello invalide"})
                continue

            # UI -> CMD
            if client_type == "ui" and msg.get("type") == "cmd":
                cmd_id = msg.get("id")
                normalized = normalize_cmd(msg)
                if not normalized:
                    log("[UI] cmd invalide:", msg)
                    await safe_send(ws, {"type": "error", "message": "cmd invalide", "id": cmd_id})
                    continue

                target = msg.get("target")
                if not isinstance(target, str) or not target:
                    target = pick_default_target()

                if not target:
                    log("[UI] cmd mais aucun PC online")
                    await safe_send(ws, {"type": "error", "message": "Aucun PC connecté", "id": cmd_id})
                    continue

                if target not in current_hosts():
                    log(f"[UI] cmd target={target} hors ligne")
                    await safe_send(ws, {"type": "error", "message": f"PC '{target}' hors ligne", "id": cmd_id})
                    continue

                log(f"[UI] cmd -> target={target} payload={normalized}")
                ok = await send_to_pc(target, normalized)
                if not ok:
                    await safe_send(ws, {"type": "error", "message": f"PC '{target}' non joignable", "id": cmd_id})
                    continue

                await safe_send(ws, {"type": "ack", "message": f"Cmd envoyée à {target}", "id": cmd_id})
                continue

            # PC -> HEARTBEAT + feedback
            if client_type == "pc":
                host = msg.get("host")
                status = msg.get("status")

                if isinstance(host, str) and host and status == "online":
                    bound_host = host
                    pc_ws_to_host[ws] = host
                    pc_host_to_ws[host] = ws
                    pc_last_seen[host] = now()
                    log(f"[PC] heartbeat host={host}")
                    await broadcast_ui(current_status())
                    continue

                if msg.get("type") in ("ack", "error"):
                    log(f"[PC] feedback: {msg}")
                    await broadcast_ui(msg)
                    continue

                continue

    except websockets.ConnectionClosed:
        pass
    finally:
        if client_type == "ui":
            ui_clients.discard(ws)
            log(f"[UI] disconnected (ui_clients={len(ui_clients)})")

        if client_type == "pc":
            pc_clients.discard(ws)
            host = pc_ws_to_host.pop(ws, None) or bound_host
            if host and pc_host_to_ws.get(host) == ws:
                pc_host_to_ws.pop(host, None)
            log(f"[PC] disconnected host={host} (pc_clients={len(pc_clients)})")


async def main() -> None:
    log(f"WebSocket MacroPad prêt (port {PORT})")
    asyncio.create_task(broadcaster_loop())

    async with websockets.serve(
        handle_client,
        host="0.0.0.0",
        port=PORT,
        ping_interval=20,
        ping_timeout=20,
        max_size=2**20,
    ):
        await asyncio.Future()


if __name__ == "__main__":
    asyncio.run(main())
