import { DurableObject } from "cloudflare:workers";
import {
	parseNetworkMessage,
	sendRequestReceivedAck,
	broadcastToAllSockets,
} from "./messageRouter";
import {
	NetworkMessageType,
	type AssignIdentityPayload,
	type MatchPresencePayload,
	type NetworkWrapper,
} from "./types";

/** Phase 1: single multiplayer slice until Sessions + routing exist. */
export const PHASE1_DEFAULT_MATCH_LEVEL_ID = "dev-default";

export const HEADER_MATCH_LEVEL_ID = "X-PP-MatchLevelId";

const REQUEST_GUID_TTL_MS = 5000;

interface SocketPlayerInfo {
	playerGuid: string;
	playerId: string;
	playerName: string;
	matchLevelId: string;
}

function generateUePlayerGuid(): string {
	return crypto.randomUUID().replace(/-/g, "").toUpperCase();
}

export class MatchLevel extends DurableObject<Env> {
	private sockets: Set<WebSocket> = new Set();
	private socketInfos: Map<WebSocket, SocketPlayerInfo> = new Map();
	private seenRequestGuids: Map<string, number> = new Map();

	constructor(ctx: DurableObjectState, env: Env) {
		super(ctx, env);
	}

	private pruneExpiredRequestGuids(): void {
		const now = Date.now();
		for (const [guid, expiry] of this.seenRequestGuids.entries()) {
			if (now > expiry) {
				this.seenRequestGuids.delete(guid);
			}
		}
	}

	private matchLevelIdFromRequest(request: Request): string {
		return (
			request.headers.get(HEADER_MATCH_LEVEL_ID)?.trim()
			|| PHASE1_DEFAULT_MATCH_LEVEL_ID
		);
	}

	private emitMatchPresence(
		subjectPlayerGuid: string,
		event: "joined" | "left",
		matchLevelId: string,
	): void {
		const payload: MatchPresencePayload = {
			event,
			matchLevelId,
			connectedCount: this.sockets.size,
		};
		const msg: NetworkWrapper = {
			messageType: NetworkMessageType.MatchPresence,
			playerGuid: subjectPlayerGuid,
			payload,
			timestamp: Date.now(),
		};
		broadcastToAllSockets(msg, this.sockets);
	}

	async fetch(request: Request): Promise<Response> {
		const matchLevelId = this.matchLevelIdFromRequest(request);

		if (request.headers.get("Upgrade")?.toLowerCase() !== "websocket") {
			return new Response("Expected WebSocket Upgrade", {
				status: 400,
			});
		}

		const playerGuid = generateUePlayerGuid();
		const pair = new WebSocketPair();
		const [clientSocket, serverSocket] = Object.values(pair);

		this.ctx.acceptWebSocket(serverSocket);

		const playerId = `guest|${crypto.randomUUID()}`;
		const playerName = `Pilot_${playerGuid.slice(0, 8)}`;

		const info: SocketPlayerInfo = {
			playerGuid,
			playerId,
			playerName,
			matchLevelId,
		};
		this.socketInfos.set(serverSocket, info);
		this.sockets.add(serverSocket);

		const identityPayload: AssignIdentityPayload = {
			playerId,
			playerName,
		};

		serverSocket.send(
			JSON.stringify({
				messageType: NetworkMessageType.AssignIdentity,
				playerGuid,
				payload: identityPayload,
				timestamp: Date.now(),
			}),
		);

		this.emitMatchPresence(playerGuid, "joined", matchLevelId);

		return new Response(null, {
			status: 101,
			webSocket: clientSocket,
		});
	}

	async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): Promise<void> {
		const raw =
			typeof message === "string" ?
				message
			:	new TextDecoder().decode(message);

		const info = this.socketInfos.get(ws);
		if (!info) {
			return;
		}

		if (raw === "__KEEPALIVE__") {
			return;
		}

		const networkMessage = parseNetworkMessage(raw);
		if (!networkMessage) {
			return;
		}

		if (networkMessage.playerGuid !== info.playerGuid) {
			return;
		}

		if (networkMessage.requestGuid) {
			this.pruneExpiredRequestGuids();
			if (this.seenRequestGuids.has(networkMessage.requestGuid)) {
				return;
			}
			this.seenRequestGuids.set(
				networkMessage.requestGuid,
				Date.now() + REQUEST_GUID_TTL_MS,
			);
			sendRequestReceivedAck(ws, info.playerGuid, networkMessage.requestGuid);
		}

		// Phase 1: no gameplay routing; RequestReceived covers client retries.
	}

	async webSocketClose(
		ws: WebSocket,
		_code: number,
		_reason: string,
		_wasClean: boolean,
	): Promise<void> {
		const info = this.socketInfos.get(ws);
		this.socketInfos.delete(ws);
		this.sockets.delete(ws);

		if (!info) {
			return;
		}

		this.emitMatchPresence(info.playerGuid, "left", info.matchLevelId);
	}
}
