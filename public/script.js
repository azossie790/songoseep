// public/script.js - Version avec salles et codes

let playerId = null;
let currentRoomCode = null;
let myCamp = null;
let pollingInterval = null;
let currentGameState = null;
let isWaitingForMoveResponse = false;

// Générer un ID unique
function generatePlayerId() {
    let id = localStorage.getItem('awale_player_id');
    if (!id) {
        id = 'player_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        localStorage.setItem('awale_player_id', id);
    }
    return id;
}

// Changer d'écran
function showScreen(screenName) {
    document.getElementById('homeScreen').classList.add('hidden');
    document.getElementById('createScreen').classList.add('hidden');
    document.getElementById('joinScreen').classList.add('hidden');
    document.getElementById('gameScreen').classList.add('hidden');
    
    document.getElementById(`${screenName}Screen`).classList.remove('hidden');
}

// Créer une partie
async function createRoom() {
    playerId = generatePlayerId();
    
    try {
        const response = await fetch('/api/create-room', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        });
        const data = await response.json();
        
        if (data.success) {
            currentRoomCode = data.roomCode;
            document.getElementById('roomCodeDisplay').textContent = currentRoomCode;
            document.getElementById('currentRoomCode').textContent = currentRoomCode;
            showScreen('create');
            
            // Commencer à attendre le second joueur
            waitForGameStart();
        }
    } catch (error) {
        console.error('Erreur création:', error);
    }
}

// Rejoindre une partie
async function joinRoom() {
    const roomCode = document.getElementById('roomCodeInput').value.toUpperCase().trim();
    if (!roomCode || roomCode.length !== 6) {
        document.getElementById('joinError').textContent = 'Code invalide (6 caractères)';
        return;
    }
    
    playerId = generatePlayerId();
    
    try {
        const response = await fetch('/api/join-room', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ roomCode, playerId })
        });
        const data = await response.json();
        
        if (data.success) {
            currentRoomCode = data.roomCode;
            myCamp = data.camp;
            document.getElementById('currentRoomCode').textContent = currentRoomCode;
            startGame();
        } else {
            document.getElementById('joinError').textContent = data.reason;
        }
    } catch (error) {
        document.getElementById('joinError').textContent = 'Erreur de connexion';
    }
}

// Attendre le début de la partie (pour le créateur)
async function waitForGameStart() {
    if (pollingInterval) clearInterval(pollingInterval);
    
    const checkInterval = setInterval(async () => {
        try {
            const response = await fetch(`/api/game-state/${currentRoomCode}?playerId=${playerId}`);
            const state = await response.json();
            
            if (state.players && state.players.sud && state.players.nord) {
                clearInterval(checkInterval);
                myCamp = state.myCamp;
                startGame();
            }
        } catch (error) {}
    }, 1000);
}

// Démarrer le jeu
function startGame() {
    showScreen('game');
    createBoard();
    startPolling();
    
    // Mettre à jour l'affichage du camp
    if (myCamp === 'sud') {
        document.getElementById('sudPlayerStatus').innerHTML = '(vous)';
    } else {
        document.getElementById('nordPlayerStatus').innerHTML = '(vous)';
    }
}

// Polling de l'état du jeu
function startPolling() {
    if (pollingInterval) clearInterval(pollingInterval);
    
    pollingInterval = setInterval(async () => {
        await fetchGameState();
    }, 500);
}

async function fetchGameState() {
    try {
        const response = await fetch(`/api/game-state/${currentRoomCode}?playerId=${playerId}`);
        const state = await response.json();
        
        if (state.error) {
            showMessage('Partie introuvable');
            leaveGame();
            return;
        }
        
        if (state.waiting) {
            document.getElementById('turnMessage').innerHTML = '⏳ En attente du second joueur...';
            return;
        }
        
        currentGameState = state;
        updateUI(state);
        
        if (!state.gameActive && state.winner) {
            if (state.winner === myCamp) {
                showMessage(`🎉 VICTOIRE ! ${state.winnerScore} points ! 🎉`);
            } else if (state.winner) {
                showMessage(`Défaite... L'adversaire a ${state.winnerScore} points`);
            }
        }
    } catch (error) {
        console.error('Erreur fetch:', error);
    }
}

async function sendMove(caseIndex) {
    if (isWaitingForMoveResponse) {
        showMessage("Attendez la réponse...");
        return;
    }
    
    if (!currentGameState || !currentGameState.gameActive) {
        showMessage("Partie terminée");
        return;
    }
    
    if (currentGameState.currentTurn !== myCamp) {
        showMessage("Ce n'est pas votre tour !");
        return;
    }
    
    isWaitingForMoveResponse = true;
    
    try {
        const response = await fetch(`/api/move/${currentRoomCode}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ playerId, caseIndex })
        });
        
        const result = await response.json();
        
        if (result.success) {
            await fetchGameState();
        } else {
            showMessage(`❌ ${result.reason}`);
        }
    } catch (error) {
        showMessage("Erreur réseau");
    } finally {
        isWaitingForMoveResponse = false;
    }
}

async function resetGame() {
    try {
        await fetch(`/api/reset/${currentRoomCode}`, { method: 'POST' });
        showMessage("Partie réinitialisée !");
        await fetchGameState();
    } catch (error) {}
}

function leaveGame() {
    if (pollingInterval) clearInterval(pollingInterval);
    currentRoomCode = null;
    myCamp = null;
    showScreen('home');
}

function createBoard() {
    // Même code que précédemment pour créer les cases
    const northContainer = document.getElementById('northCells');
    northContainer.innerHTML = '';
    for (let i = 6; i >= 0; i--) {
        const cell = document.createElement('div');
        cell.className = 'cell';
        cell.id = `nord-${i}`;
        cell.innerHTML = `<div class="cell-number">Case ${i+1}</div><div class="cell-seeds">5</div>`;
        cell.addEventListener('click', (function(idx) { return function() { sendMove(idx); }; })(i));
        northContainer.appendChild(cell);
    }
    
    const southContainer = document.getElementById('southCells');
    southContainer.innerHTML = '';
    for (let i = 0; i < 7; i++) {
        const cell = document.createElement('div');
        cell.className = 'cell';
        cell.id = `sud-${i}`;
        cell.innerHTML = `<div class="cell-number">Case ${i+1}</div><div class="cell-seeds">5</div>`;
        cell.addEventListener('click', (function(idx) { return function() { sendMove(idx); }; })(i));
        southContainer.appendChild(cell);
    }
}

function updateUI(state) {
    // Mise à jour des scores et des cases (même code qu'avant)
    document.getElementById('sudScore').textContent = state.scores.sud;
    document.getElementById('nordScore').textContent = state.scores.nord;
    
    for (let i = 0; i < 7; i++) {
        const sudCell = document.getElementById(`sud-${i}`);
        if (sudCell) sudCell.querySelector('.cell-seeds').textContent = state.board.sud[i];
        const nordCell = document.getElementById(`nord-${i}`);
        if (nordCell) nordCell.querySelector('.cell-seeds').textContent = state.board.nord[i];
    }
    
    const turnMessage = document.getElementById('turnMessage');
    if (state.gameActive) {
        turnMessage.innerHTML = state.currentTurn === myCamp ? '🎯 VOTRE TOUR !' : `👀 Tour de l'adversaire (${state.currentTurn.toUpperCase()})`;
    }
}

function showMessage(msg) {
    const msgDiv = document.getElementById('message');
    msgDiv.textContent = msg;
    setTimeout(() => { if (msgDiv.textContent === msg) msgDiv.textContent = ''; }, 3000);
}

// Événements
document.getElementById('createRoomBtn').onclick = () => createRoom();
document.getElementById('joinRoomBtn').onclick = () => showScreen('join');
document.getElementById('confirmJoinBtn').onclick = () => joinRoom();
document.getElementById('backFromCreateBtn').onclick = () => leaveGame();
document.getElementById('backFromJoinBtn').onclick = () => showScreen('home');
document.getElementById('resetGameBtn').onclick = () => resetGame();
document.getElementById('leaveGameBtn').onclick = () => leaveGame();
document.getElementById('copyCodeBtn').onclick = () => {
    navigator.clipboard.writeText(currentRoomCode);
    showMessage('Code copié !');
};

// Initialisation
playerId = generatePlayerId();
showScreen('home');
