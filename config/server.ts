import { spawn, type ChildProcessWithoutNullStreams } from "child_process";
import WebSocket, { WebSocketServer, type RawData } from "ws";
import { URL } from "url";
import http from "http";

const PORT = 30121;
const SHUTDOWN_TIMEOUT = 45000;
const SHUTDOWN_COMMANDS = {
    docker: "trigger_shutdown docker container_stop 45",
    manual: "trigger_shutdown console manual 45"
};

const API_KEY = process.env.WEBSOCKET_API_KEY;
if (!API_KEY) {
    console.warn("WARNING: WEBSOCKET_API_KEY not set - server will accept all connections");
} else {
    console.log("WebSocket API key authentication enabled");
}

function validateApiKey(authHeader?: string, queryParams?: Record<string, string>): boolean {
    if (!API_KEY) {
        return true;
    }

    if (authHeader) {
        const match = authHeader.match(/^Bearer\s+(.+)$/i);
        if (match && match[1] === API_KEY) {
            return true;
        }
    }

    if (queryParams && queryParams.api_key === API_KEY) {
        return true;
    }

    return false;
}

const additionalArgs = [
    "+set", "citizen_dir", "/opt/cfx-server/citizen/",
    ...process.argv.slice(2)
];

const wss = new WebSocketServer({ noServer: true });
let fxServer: ChildProcessWithoutNullStreams | null = null;
const connectedClients = new Set<WebSocket>();

function broadcastClients(data: Record<string, unknown>): void {
    const message = JSON.stringify(data);
    connectedClients.forEach((ws) => {
        if (ws.readyState === WebSocket.OPEN) {
            ws.send(message);
        }
    });
}

const server = http.createServer((_req, res) => {
    res.writeHead(426, { "Content-Type": "text/plain" });
    res.end("Use WebSocket protocol");
});

server.on("upgrade", (req, socket, head) => {
    const host = req.headers.host ?? "localhost";
    const urlObj = new URL(req.url ?? "/", `http://${host}`);
    const queryParams = Object.fromEntries(urlObj.searchParams.entries());
    const authHeader = req.headers.authorization;

    if (!validateApiKey(authHeader, queryParams)) {
        console.warn(`Rejected unauthorized connection from ${req.socket.remoteAddress}`);
        socket.write("HTTP/1.1 401 Unauthorized\r\nContent-Type: text/plain\r\nConnection: close\r\n\r\nUnauthorized");
        socket.destroy();
        return;
    }

    console.log(`Authenticated connection from ${req.socket.remoteAddress}`);
    wss.handleUpgrade(req, socket, head, (ws) => {
        wss.emit("connection", ws, req);
    });
});

function startFiveM(): void {
    console.log("Starting FiveM server...");

    fxServer = spawn("/opt/cfx-server/ld-musl-x86_64.so.1", [
        "--library-path", "/usr/lib/v8/:/lib/:/usr/lib/",
        "--",
        "/opt/cfx-server/FXServer",
        ...additionalArgs
    ], {
        cwd: "/config",
        stdio: ["pipe", "pipe", "pipe"]
    });

    fxServer.stdout.on("data", (data: Buffer) => {
        const message = data.toString();
        console.log(message);
        broadcastClients({ type: "stdout", data: message });
    });

    fxServer.stderr.on("data", (data: Buffer) => {
        const message = data.toString();
        console.error(message);
        broadcastClients({ type: "stderr", data: message });
    });

    fxServer.on("close", (code: number | null) => {
        console.log(`FiveM server exited with code ${code}`);
        broadcastClients({ type: "server_exit", code });
    });

    fxServer.on("error", (error: Error) => {
        console.error("FiveM server error:", error);
    });
}

wss.on("connection", (ws: WebSocket) => {
    console.log("Client connected");
    connectedClients.add(ws);
    ws.send(JSON.stringify({ type: "connection", message: "Connected to FiveM WebSocket" }));

    ws.on("message", (msg: RawData) => {
        const rawMessage = typeof msg === "string" ? msg : msg.toString();

        try {
            const data = JSON.parse(rawMessage) as { type?: string; command?: string };
            if (data.type === "command" && typeof data.command === "string" && fxServer) {
                fxServer.stdin.write(`${data.command}\n`);
                console.log(`Command: ${data.command}`);
            }
        } catch {
            // Fallback: treat as plain text command
            if (fxServer) {
                fxServer.stdin.write(`${rawMessage}\n`);
            }
        }
    });

    ws.on("close", () => {
        console.log("Client disconnected");
        connectedClients.delete(ws);
    });

    ws.on("error", (error: Error) => {
        console.error(`WebSocket error: ${error.message}`);
        connectedClients.delete(ws);
    });
});

function shutdown(command: string): void {
    if (isShuttingDown) return;
    isShuttingDown = true;

    console.log(`Shutdown initiated, waiting ${SHUTDOWN_TIMEOUT / 1000}s for graceful save...`);
    
    if (fxServer && fxServer.stdin.writable) {
        fxServer.stdin.write(`${command}\n`);
    }

    wss.close();

    setTimeout(() => {
        console.log("Timeout reached, killing server...");
        if (fxServer) {
            fxServer.kill("SIGTERM");
        }
        process.exit(0);
    }, SHUTDOWN_TIMEOUT);
}

let isShuttingDown = false;

process.on("SIGTERM", () => shutdown(SHUTDOWN_COMMANDS.docker));
process.on("SIGINT", () => shutdown(SHUTDOWN_COMMANDS.manual));

console.log(`Listening on port ${PORT}`);
server.listen(PORT, () => {
    console.log(`WebSocket server ready on port ${PORT}`);
});

console.log("Starting FiveM server...");
startFiveM();
