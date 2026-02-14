import { spawn } from "child_process";
import WebSocket, { WebSocketServer } from "ws";
import { URL } from "url";
import http from "http";

console.log("Starting WebSocket server on port 30121...");

// Get API key from environment variable
const API_KEY = process.env.WEBSOCKET_API_KEY;
if (!API_KEY) {
    console.warn("⚠️  WARNING: WEBSOCKET_API_KEY environment variable is not set!");
    console.warn("The WebSocket server will be open without authentication!");
    console.warn("Set WEBSOCKET_API_KEY to enable API key authentication.");
} else {
    console.log("✓ WebSocket API key authentication enabled");
}

// Utility function to validate API key
function validateApiKey(authHeader, queryParams) {
    if (!API_KEY) {
        return true; // No API key set, allow all connections
    }

    // Check Bearer token in Authorization header
    if (authHeader) {
        const match = authHeader.match(/^Bearer\s+(.+)$/i);
        if (match && match[1] === API_KEY) {
            return true;
        }
    }

    // Check api_key query parameter
    if (queryParams && queryParams.api_key === API_KEY) {
        return true;
    }

    return false;
}

    const additional_args = [
            "+set", "citizen_dir", "/opt/cfx-server/citizen/",
            ...process.argv.slice(2) // Pass through any additional arguments
    ];

const wss = new WebSocketServer({ noServer: true });
let fxServer = null;
let connectedClients = new Set();

// Create HTTP server for WebSocket upgrade handling
const server = http.createServer((req, res) => {
    res.writeHead(426, { 'Content-Type': 'text/plain' });
    res.end('Use WebSocket protocol');
});

// Handle WebSocket upgrade requests with authentication
server.on('upgrade', (req, socket, head) => {
    const urlObj = new URL(req.url, `http://${req.headers.host}`);
    const queryParams = Object.fromEntries(urlObj.searchParams);
    const authHeader = req.headers.authorization;

    // Validate API key
    if (!validateApiKey(authHeader, queryParams)) {
        console.warn(`❌ Connection attempt with invalid or missing API key from ${req.socket.remoteAddress}`);
        socket.write('HTTP/1.1 401 Unauthorized\r\n');
        socket.write('Content-Type: text/plain\r\n');
        socket.write('Connection: close\r\n');
        socket.write('\r\n');
        socket.write('Unauthorized: Invalid or missing API key');
        socket.destroy();
        return;
    }

    // API key valid, proceed with WebSocket connection
    console.log(`✓ Authenticated connection from ${req.socket.remoteAddress}`);
    wss.handleUpgrade(req, socket, head, (ws) => {
        wss.emit('connection', ws, req);
    });
});

// Start FiveM server
function startFiveM() {
    console.log("Starting FiveM server...");
    
    fxServer = spawn("/opt/cfx-server/ld-musl-x86_64.so.1", [
        "--library-path", "/usr/lib/v8/:/lib/:/usr/lib/",
        "--",
        "/opt/cfx-server/FXServer",
        ...additional_args
    ], {
        cwd: "/config",
        stdio: ['pipe', 'pipe', 'pipe']
    });

    fxServer.stdout.on("data", data => {
        const message = data.toString();
        console.log(message);
        
        // Broadcast to all connected WebSocket clients
        connectedClients.forEach(ws => {
            if (ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({
                    type: "stdout",
                    data: message
                }));
            }
        });
    });

    fxServer.stderr.on("data", data => {
        const message = data.toString();
        console.error(message);
        
        // Broadcast to all connected WebSocket clients
        connectedClients.forEach(ws => {
            if (ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({
                    type: "stderr",
                    data: message
                }));
            }
        });
    });

    fxServer.on("close", (code) => {
        console.log(`FiveM server exited with code ${code}`);
        // Notify all clients that server has stopped
        connectedClients.forEach(ws => {
            if (ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({
                    type: "server_exit",
                    code: code
                }));
            }
        });
    });

    fxServer.on("error", (error) => {
        console.error("FiveM server error:", error);
    });
}

wss.on("connection", ws => {
    console.log("Web client connected");
    connectedClients.add(ws);

    // Send initial connection message
    ws.send(JSON.stringify({
        type: "connection",
        message: "Connected to FiveM server WebSocket"
    }));

    ws.on("message", msg => {
        try {
            const data = JSON.parse(msg);
            
            if (data.type === "command" && fxServer && fxServer.stdin) {
                // Send command to FiveM server
                fxServer.stdin.write(data.command + "\n");
                console.log("Command sent to FiveM:", data.command);
            }
        } catch (error) {
            // Fallback for plain text messages
            if (fxServer && fxServer.stdin) {
                fxServer.stdin.write(msg + "\n");
            }
        }
    });

    ws.on("close", () => {
        console.log("Web client disconnected");
        connectedClients.delete(ws);
    });

    ws.on("error", (error) => {
        console.error("WebSocket error:", error);
        connectedClients.delete(ws);
    });
});

wss.on("error", (error) => {
    console.error("WebSocket server error:", error);
});

// Handle graceful shutdown from Docker
let isShuttingDown = false;
const SHUTDOWN_TIMEOUT = 45000; // 45 seconds

process.on('SIGTERM', () => {
    if (isShuttingDown) return;
    isShuttingDown = true;
    
    console.log("Received SIGTERM from Docker - initiating graceful shutdown...");
    console.log(`Waiting ${SHUTDOWN_TIMEOUT / 1000} seconds for server to save data...`);
    
    // Trigger the shutdown event in FiveM
    const shutdownCommand = 'trigger_shutdown docker container_stop 45';
    if (fxServer && fxServer.stdin) {
        fxServer.stdin.write(shutdownCommand + '\n');
        console.log("Sent shutdown command to FiveM server");
    }
    
    // Close WebSocket server but keep FiveM running for 45 seconds
    wss.close();
    
    // Wait 45 seconds, then kill the server
    setTimeout(() => {
        console.log("Shutdown timeout reached, killing FiveM server...");
        if (fxServer) {
            fxServer.kill('SIGTERM');
        }
        process.exit(0);
    }, SHUTDOWN_TIMEOUT);
});

process.on('SIGINT', () => {
    if (isShuttingDown) return;
    isShuttingDown = true;
    
    console.log("Received SIGINT - shutting down gracefully...");
    console.log(`Waiting ${SHUTDOWN_TIMEOUT / 1000} seconds for server to save data...`);
    
    const shutdownCommand = 'trigger_shutdown console manual 45';
    if (fxServer && fxServer.stdin) {
        fxServer.stdin.write(shutdownCommand + '\n');
    }
    
    wss.close();
    
    setTimeout(() => {
        console.log("Shutdown timeout reached, killing FiveM server...");
        if (fxServer) {
            fxServer.kill('SIGTERM');
        }
        process.exit(0);
    }, SHUTDOWN_TIMEOUT);
});

console.log("WebSocket server started on port 30121");

// Listen on port 30121
server.listen(30121, () => {
    console.log("HTTP server listening on port 30121 for WebSocket upgrades");
});

// Start the FiveM server
startFiveM();
