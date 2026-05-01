/**
 * Network wrapper enums and shapes aligned with Gilded Gloom–style envelopes.
 */

export enum NetworkMessageType {
	AssignIdentity = "AssignIdentity",
	RequestReceived = "RequestReceived",
	MatchPresence = "MatchPresence",
	Unknown = "Unknown",
}

export interface NetworkWrapper {
	messageType: string;
	playerGuid: string;
	payload: unknown;
	timestamp?: number;
	requestGuid?: string;
}

/** Matches Gilded Gloom: `AssignIdentity` payload is `playerId` + `playerName` only. */
export interface AssignIdentityPayload {
	playerId?: string;
	playerName?: string;
}

export interface MatchPresencePayload {
	connectedCount: number;
	event: "joined" | "left";
	matchLevelId: string;
}
