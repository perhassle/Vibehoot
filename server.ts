import "dotenv/config";
import { createServer } from "http";
import next from "next";
import { Server } from "socket.io";
import { GameEngine } from "./src/lib/game-engine";

const dev = process.env.NODE_ENV !== "production";
const hostname = "localhost";
const port = 3000;
const app = next({ dev, hostname, port });
const handler = app.getRequestHandler();

app.prepare().then(() => {
    const httpServer = createServer(handler);

    const io = new Server(httpServer, {
        cors: {
            origin: "*",
            methods: ["GET", "POST"]
        }
    });

    io.on("connection", (socket) => {
        console.log("Client connected", socket.id);

        // Host creates a game
        socket.on("create_game", async ({ quizId, hostId }, callback) => {
            try {
                console.log("Creating game", quizId, hostId);
                const joinCode = await GameEngine.createSession(quizId, hostId);
                socket.join(joinCode); // Host joins the room
                callback({ success: true, joinCode });
            } catch (e: any) {
                console.error(e);
                callback({ success: false, error: e.message });
            }
        });

        // Player joins a game
        socket.on("join_game", async ({ joinCode, nickname, playerId }, callback) => {
            try {
                console.log("Joining game", joinCode, nickname);
                const state = await GameEngine.joinSession(joinCode, nickname, playerId);
                socket.join(joinCode); // Player joins the room

                // Notify host and other players
                io.to(joinCode).emit("player_joined", { playerId, nickname, score: 0 });

                callback({ success: true, state });
            } catch (e: any) {
                console.error(e);
                callback({ success: false, error: e.message });
            }
        });

        // Host starts the game
        socket.on("start_game", async ({ joinCode }, callback) => {
            try {
                console.log("Starting game", joinCode);
                // Logic to update state to ACTIVE and broadcast 'game_start'
                // For now, just emitting event
                io.to(joinCode).emit("game_started");
                callback({ success: true });
            } catch (e: any) {
                callback({ success: false, error: e.message });
            }
        });

        socket.on("disconnect", () => {
            console.log("Client disconnected", socket.id);
        });
    });

    httpServer
        .once("error", (err) => {
            console.error(err);
            process.exit(1);
        })
        .listen(port, () => {
            console.log(`> Ready on http://${hostname}:${port}`);
        });
});
