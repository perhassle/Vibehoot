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
                socket.data.joinCode = joinCode;
                socket.data.playerId = playerId;

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
                await GameEngine.startGame(joinCode);
                io.to(joinCode).emit("game_started");
                callback({ success: true });
            } catch (e: any) {
                callback({ success: false, error: e.message });
            }
        });

        // Host requests next question
        socket.on("next_question", async ({ joinCode }, callback) => {
            try {
                console.log("Next question", joinCode);
                const { question, totalQuestions, state } = await GameEngine.nextQuestion(joinCode);

                if (question) {
                    // Send question to all (without correct answer for players)
                    io.to(joinCode).emit("question_start", {
                        questionIndex: state.currentQuestionIndex,
                        totalQuestions,
                        text: question.text,
                        options: question.options,
                        timeLimit: question.timeLimit
                    });
                    callback({ success: true, question, totalQuestions, questionIndex: state.currentQuestionIndex });
                } else {
                    // Game ended
                    const leaderboard = await GameEngine.getLeaderboard(joinCode);
                    io.to(joinCode).emit("game_ended", { leaderboard });
                    callback({ success: true, ended: true, leaderboard });
                }
            } catch (e: any) {
                console.error(e);
                callback({ success: false, error: e.message });
            }
        });

        // Player submits answer
        socket.on("submit_answer", async ({ joinCode, playerId, optionIndex }, callback) => {
            try {
                console.log("Answer submitted", joinCode, playerId, optionIndex);
                const result = await GameEngine.submitAnswer(joinCode, playerId, optionIndex);

                // Get current answer count
                const state = await GameEngine.getSession(joinCode);
                const answerCount = state ? Object.keys(state.answers).length : 0;
                const totalPlayers = state ? Object.keys(state.players).length : 0;

                // Notify host of answer count update
                io.to(joinCode).emit("answer_count_update", { answerCount, totalPlayers });

                // Send result back to player
                callback({ success: true, ...result });

                // Also emit to the specific player
                socket.emit("answer_result", result);
            } catch (e: any) {
                console.error(e);
                callback({ success: false, error: e.message });
            }
        });

        // Host ends question and shows results
        socket.on("show_results", async ({ joinCode }, callback) => {
            try {
                console.log("Showing results", joinCode);
                const results = await GameEngine.showResults(joinCode);

                io.to(joinCode).emit("question_results", {
                    correctOptionIndex: results.correctOptionIndex,
                    answerDistribution: results.answerDistribution,
                    correctCount: results.correctCount
                });

                callback({ success: true, ...results });
            } catch (e: any) {
                console.error(e);
                callback({ success: false, error: e.message });
            }
        });

        // Host requests leaderboard
        socket.on("get_leaderboard", async ({ joinCode }, callback) => {
            try {
                const leaderboard = await GameEngine.getLeaderboard(joinCode);
                io.to(joinCode).emit("leaderboard_update", { leaderboard });
                callback({ success: true, leaderboard });
            } catch (e: any) {
                console.error(e);
                callback({ success: false, error: e.message });
            }
        });

        socket.on("disconnect", () => {
            console.log("Client disconnected", socket.id);
            // Could notify room of player disconnect here
            if (socket.data.joinCode && socket.data.playerId) {
                io.to(socket.data.joinCode).emit("player_disconnected", {
                    playerId: socket.data.playerId
                });
            }
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
