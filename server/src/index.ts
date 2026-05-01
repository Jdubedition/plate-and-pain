import {
	MatchLevel,
	PHASE1_DEFAULT_MATCH_LEVEL_ID,
	HEADER_MATCH_LEVEL_ID,
} from "./matchLevel";

// Only Durable Object classes may be named exports alongside `default`; string
// constants (e.g. HEADER_MATCH_LEVEL_ID) break Workers module registration.
export { MatchLevel };

async function handleFetch(request: Request, env: Env): Promise<Response> {
	const url = new URL(request.url);

	if (request.method === "GET" && url.pathname === "/health") {
		return new Response("OK", { status: 200 });
	}

	if (
		request.method === "GET" &&
		url.pathname === "/connect" &&
		request.headers.get("Upgrade")?.toLowerCase() === "websocket"
	) {
		const stub = env.MATCH_LEVEL.get(
			env.MATCH_LEVEL.idFromName(PHASE1_DEFAULT_MATCH_LEVEL_ID),
		);
		const headers = new Headers(request.headers);
		headers.set(HEADER_MATCH_LEVEL_ID, PHASE1_DEFAULT_MATCH_LEVEL_ID);
		return stub.fetch(new Request(request, { headers }));
	}

	return new Response(JSON.stringify({ error: "Not found" }), {
		status: 404,
		headers: { "Content-Type": "application/json" },
	});
}

export default {
	async fetch(
		request: Request,
		env: Env,
		_ctx: ExecutionContext,
	): Promise<Response> {
		try {
			return await handleFetch(request, env);
		} catch (error: unknown) {
			if (request.headers.get("upgrade")?.toLowerCase() === "websocket") {
				const pair = new WebSocketPair();
				const [client, server] = Object.values(pair);
				server.accept();
				server.send(
					JSON.stringify({
						error: error instanceof Error ? error.message : String(error),
					}),
				);
				server.close(1011, "Server error");
				return new Response(null, {
					status: 101,
					webSocket: client,
				});
			}
			return new Response(
				JSON.stringify({
					error: error instanceof Error ? error.message : String(error),
				}),
				{
					status: 500,
					headers: { "Content-Type": "application/json" },
				},
			);
		}
	},
};
