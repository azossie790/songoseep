const express = require('express');
const cors = require('cors');
const path = require('path');
const gameLogic = require('./gameLogic');

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// État du jeu stocké en mémoire
let gameState = gameLogic.createInitialState();
let waitingPlayer = null;  // Joueur qui attend un adversaire
let playerSessions = {};

// Routes API
app.get('/api/game-state', (req, res) => {
    // Ne pas envoyer l'état complet si la partie n'a pas commencé
    if (!gameState.players.sud || !gameState.players.nord) {
        return res.json({
            gameActive: false,
            waiting: true,
            message: "En attente d'un second joueur..."
        });
    }
    
    res.json({
        board: gameState.board,
        scores: gameState.scores,
        currentTurn: gameState.currentTurn,
        gameActive: gameState.gameActive,
        winner: gameState.winner,
        winnerScore: gameState.winnerScore,
        lastMove: gameState.lastMove,
        youAre: null  // Sera défini par le client
    });
});

app.post('/api/join', (req, res) => {
    const { playerId } = req.body;
    
    // Assigner le joueur à un camp
    if (!gameState.players.sud) {
        gameState.players.sud = playerId;
        playerSessions[playerId] = { camp: gameLogic.SUD, playerId };
        return res.json({ success: true, camp: gameLogic.SUD, message: "Vous êtes le joueur SUD ! En attente d'un adversaire..." });
    } else if (!gameState.players.nord && gameState.players.sud !== playerId) {
        gameState.players.nord = playerId;
        playerSessions[playerId] = { camp: gameLogic.NORD, playerId };
        return res.json({ success: true, camp: gameLogic.NORD, message: "Vous êtes le joueur NORD ! La partie commence !" });
    } else if (gameState.players.sud === playerId || gameState.players.nord === playerId) {
        return res.json({ success: true, camp: playerSessions[playerId]?.camp, message: "Reconnexion réussie" });
    } else {
        return res.json({ success: false, message: "Partie pleine, veuillez réessayer plus tard" });
    }
});

app.post('/api/move', (req, res) => {
    const { playerId, caseIndex } = req.body;
    
    // Vérifier que le joueur existe
    if (!playerSessions[playerId]) {
        return res.json({ success: false, reason: "Joueur non reconnu" });
    }
    
    const camp = playerSessions[playerId].camp;
    
    // Vérifier que la partie est active
    if (!gameState.gameActive) {
        return res.json({ success: false, reason: "Partie terminée", gameOver: true, winner: gameState.winner });
    }
    
    // Vérifier que c'est son tour
    if (gameState.currentTurn !== camp) {
        return res.json({ success: false, reason: "Ce n'est pas votre tour" });
    }
    
    // Vérifier que les deux joueurs sont présents
    if (!gameState.players.sud || !gameState.players.nord) {
        return res.json({ success: false, reason: "En attente d'un adversaire" });
    }
    
    // Exécuter le coup
    const result = gameLogic.executeMove(gameState.board, gameState.scores, camp, caseIndex);
    
    if (!result.success) {
        if (result.gameOver) {
            gameState.gameActive = false;
            return res.json({ success: false, reason: result.reason, gameOver: true });
        }
        return res.json({ success: false, reason: result.reason });
    }
    
    // Sauvegarder le dernier coup
    gameState.lastMove = { player: camp, caseIndex, timestamp: Date.now() };
    
    // Vérifier la fin de partie
    const gameEnded = gameLogic.checkGameOver(gameState.board, gameState.scores, gameState);
    
    if (!gameEnded) {
        // Changer de tour
        gameState.currentTurn = gameLogic.getAdversaire(camp);
    }
    
    res.json({
        success: true,
        board: gameState.board,
        scores: gameState.scores,
        currentTurn: gameState.currentTurn,
        gameActive: gameState.gameActive,
        winner: gameState.winner,
        lastMove: gameState.lastMove
    });
});

app.post('/api/reset', (req, res) => {
    gameState = gameLogic.createInitialState();
    playerSessions = {};
    waitingPlayer = null;
    res.json({ success: true });
});

app.listen(PORT, () => {
    console.log(`Serveur Awélé démarré sur http://localhost:${PORT}`);
    console.log(`Deux joueurs peuvent se connecter pour jouer en ligne !`);
});