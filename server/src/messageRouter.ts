import { NetworkMessageType, type NetworkWrapper } from "./types";

/**
 * Parse incoming JSON and validate GG-style wrapper (`messageType` + `playerGuid`).
 */
export function parseNetworkMessage(message: string): NetworkWrapper | null {
	const trimmed = message.trim();
	if (!trimmed.startsWith("{") && !trimmed.startsWith("[")) {
		return null;
	}
	try {
		const parsed = JSON.parse(message) as Record<string, unknown>;
		const messageType =
			typeof parsed.messageType === "string" ? parsed.messageType : "";
		const playerGuid =
			typeof parsed.playerGuid === "string" ? parsed.playerGuid : "";
		if (!messageType || !playerGuid) {
			return null;
		}
		const wrapper: NetworkWrapper = {
			messageType,
			playerGuid,
			payload:
				Object.prototype.hasOwnProperty.call(parsed, "payload") ?
					parsed.payload
				:	{},
			timestamp:
				typeof parsed.timestamp === "number" ? parsed.timestamp : Date.now(),
		};
		if (typeof parsed.requestGuid === "string") {
			wrapper.requestGuid = parsed.requestGuid;
		}
		return wrapper;
	} catch {
		return null;
	}
}

export function sendRequestReceivedAck(
	socket: WebSocket,
	playerGuid: string,
	requestGuid: string,
): void {
	try {
		socket.send(
			JSON.stringify({
				messageType: NetworkMessageType.RequestReceived,
				playerGuid,
				requestGuid,
				payload: {},
				timestamp: Date.now(),
			}),
		);
	} catch {
		// Ignore send failures on dead sockets.
	}
}

export function broadcastToAllSockets(payload: unknown, sockets: Set<WebSocket>): void {
	const message =
		typeof payload === "string" ? payload : JSON.stringify(payload);
	for (const socket of Array.from(sockets)) {
		try {
			socket.send(message);
		} catch {
			try {
				socket.close(1011, "Broadcast error");
			} catch {
				//
			}
			sockets.delete(socket);
		}
	}
}
