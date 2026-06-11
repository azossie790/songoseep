// public/script.js - Client AJAX complet

const API_URL = window.location.origin;
let playerId = null;
let myCamp = null;
let pollingInterval = null;
let lastMoveTimestamp = 0;
let currentGameState = null;
let isWaitingForMoveResponse = false;

// Générer un ID unique pour ce joueur
function generatePlayerId() {
    return 'player_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

// Rejoindre la partie
async function joinGame() {
    playerId = localStorage.getItem('awale_player_id');
    if (!playerId) {
        playerId = generatePlayerId();
        localStorage.setItem('awale_player_id', playerId);
    }
    
    try {
        const response = await fetch(`${API_URL}/api/join`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ playerId })
        });
        const data = await response.json();
        
        if (data.success) {
            myCamp = data.camp;
            document.getElementById('connectionStatus').innerHTML = `✅ Connecté en tant que Joueur ${myCamp.toUpperCase()}`;
            document.getElementById('playerInfo').innerHTML = `👤 Vous êtes le joueur <strong>${myCamp.toUpperCase()}</strong>`;
            
            if (myCamp === 'sud') {
                document.getElementById('sudPlayerStatus').innerHTML = '(vous)';
                document.getElementById('sudPlayerStatus').style.color = '#2ecc71';
            } else {
                document.getElementById('nordPlayerStatus').innerHTML = '(vous)';
                document.getElementById('nordPlayerStatus').style.color = '#2ecc71';
            }
            
            startPolling();
        } else {
            document.getElementById('connectionStatus').innerHTML = `❌ ${data.message}`;
            document.getElementById('playerInfo').innerHTML = `⚠️ Partie pleine, rafraîchissez plus tard`;
        }
    } catch (error) {
        console.error('Erreur de connexion:', error);
        document.getElementById('connectionStatus').innerHTML = `❌ Erreur de connexion au serveur`;
    }
}

// Démarrer le polling AJAX
function startPolling() {
    if (pollingInterval) clearInterval(pollingInterval);
    
    pollingInterval = setInterval(async () => {
        await fetchGameState();
    }, 500); // Polling toutes les 0.5 secondes pour plus de réactivité
}

// Récupérer l'état du jeu
async function fetchGameState() {
    try {
        const response = await fetch(`${API_URL}/api/game-state`);
        const state = await response.json();
        
        if (state.waiting) {
            document.getElementById('turnMessage').innerHTML = '⏳ En attente d\'un adversaire...';
            return;
        }
        
        currentGameState = state;
        updateUI(state);
        
        // Vérifier si le dernier coup est nouveau (pour animation)
        if (state.lastMove && state.lastMove.timestamp > lastMoveTimestamp) {
            lastMoveTimestamp = state.lastMove.timestamp;
            if (state.lastMove.player !== myCamp) {
                showMessage(`🎯 L'adversaire a joué la case ${state.lastMove.caseIndex + 1}`);
                highlightCell(state.lastMove.player === 'sud' ? 'sud' : 'nord', state.lastMove.caseIndex);
            }
        }
        
        // Vérifier la fin de partie
        if (!state.gameActive && state.winner) {
            if (state.winner === myCamp) {
                showMessage(`🎉 FÉLICITATIONS ! Vous avez gagné avec ${state.winnerScore} points ! 🎉`);
            } else if (state.winner) {
                showMessage(`😢 L'adversaire a gagné avec ${state.winnerScore} points...`);
            } else {
                showMessage(`🤝 Partie nulle !`);
            }
        }
    } catch (error) {
        console.error('Erreur fetch game state:', error);
    }
}

// Envoyer un coup
async function sendMove(caseIndex) {
    if (isWaitingForMoveResponse) {
        showMessage("⏳ Veuillez attendre la réponse du serveur...");
        return false;
    }
    
    if (!currentGameState || !currentGameState.gameActive) {
        showMessage("Partie terminée ou inexistante");
        return false;
    }
    
    if (currentGameState.currentTurn !== myCamp) {
        showMessage("Ce n'est pas votre tour !");
        return false;
    }
    
    isWaitingForMoveResponse = true;
    
    try {
        const response = await fetch(`${API_URL}/api/move`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ playerId, caseIndex })
        });
        
        const result = await response.json();
        
        if (result.success) {
            showMessage(`✓ Coup joué case ${caseIndex + 1}`);
            await fetchGameState(); // Rafraîchir immédiatement
        } else {
            showMessage(`❌ ${result.reason}`);
            if (result.gameOver) {
                await fetchGameState();
            }
        }
    } catch (error) {
        console.error('Erreur lors du coup:', error);
        showMessage("❌ Erreur réseau, veuillez réessayer");
    } finally {
        isWaitingForMoveResponse = false;
    }
}

// Réinitialiser la partie
async function resetGame() {
    try {
        await fetch(`${API_URL}/api/reset`, { method: 'POST' });
        showMessage("🔄 Partie réinitialisée !");
        await fetchGameState();
    } catch (error) {
        console.error('Erreur reset:', error);
    }
}

// Mettre à jour l'interface
function updateUI(state) {
    // Mettre à jour les scores
    document.getElementById('sudScore').textContent = state.scores.sud;
    document.getElementById('nordScore').textContent = state.scores.nord;
    
    // Mettre à jour l'indicateur de tour
    const turnMessage = document.getElementById('turnMessage');
    if (state.gameActive) {
        if (state.currentTurn === 'sud') {
            turnMessage.innerHTML = '🎲 Tour du Joueur SUD ' + (myCamp === 'sud' ? '(Votre tour !)' : '(Adversaire)');
            turnMessage.style.color = myCamp === 'sud' ? '#2ecc71' : '#e74c3c';
        } else {
            turnMessage.innerHTML = '🎲 Tour du Joueur NORD ' + (myCamp === 'nord' ? '(Votre tour !)' : '(Adversaire)');
            turnMessage.style.color = myCamp === 'nord' ? '#2ecc71' : '#e74c3c';
        }
    } else if (state.winner) {
        turnMessage.innerHTML = `🏆 GAGNANT : ${state.winner.toUpperCase()} avec ${state.winnerScore} points 🏆`;
    } else {
        turnMessage.innerHTML = '🤝 PARTIE NULLE';
    }
    
    // Mettre à jour les cases SUD
    for (let i = 0; i < 7; i++) {
        const cell = document.getElementById(`sud-${i}`);
        if (cell) {
            const seedsSpan = cell.querySelector('.cell-seeds');
            seedsSpan.textContent = state.board.sud[i];
            
            const canPlay = state.gameActive && 
                           myCamp === 'sud' && 
                           state.currentTurn === 'sud' && 
                           state.board.sud[i] > 0 &&
                           !isWaitingForMoveResponse;
            
            if (!canPlay) {
                cell.classList.add('disabled');
            } else {
                cell.classList.remove('disabled');
            }
        }
    }
    
    // Mettre à jour les cases NORD
    for (let i = 0; i < 7; i++) {
        const cell = document.getElementById(`nord-${i}`);
        if (cell) {
            const seedsSpan = cell.querySelector('.cell-seeds');
            seedsSpan.textContent = state.board.nord[i];
            
            const canPlay = state.gameActive && 
                           myCamp === 'nord' && 
                           state.currentTurn === 'nord' && 
                           state.board.nord[i] > 0 &&
                           !isWaitingForMoveResponse;
            
            if (!canPlay) {
                cell.classList.add('disabled');
            } else {
                cell.classList.remove('disabled');
            }
        }
    }
}

function highlightCell(camp, index) {
    const cellId = `${camp}-${index}`;
    const cell = document.getElementById(cellId);
    if (cell) {
        cell.classList.add('highlight');
        setTimeout(() => cell.classList.remove('highlight'), 1000);
    }
}

function showMessage(msg) {
    const msgDiv = document.getElementById('message');
    msgDiv.textContent = msg;
    setTimeout(() => {
        if (document.getElementById('message').textContent === msg) {
            setTimeout(() => {
                if (document.getElementById('message').textContent === msg) {
                    document.getElementById('message').textContent = '';
                }
            }, 3000);
        }
    }, 100);
}

// Créer le plateau HTML
function createBoard() {
    // Cases NORD (affichées de 7 à 1)
    const northContainer = document.getElementById('northCells');
    northContainer.innerHTML = '';
    for (let i = 6; i >= 0; i--) {
        const cell = document.createElement('div');
        cell.className = 'cell';
        cell.id = `nord-${i}`;
        cell.innerHTML = `
            <div class="cell-number">Case ${i+1}</div>
            <div class="cell-seeds">5</div>
        `;
        cell.addEventListener('click', (function(idx) {
            return function() { sendMove(idx); };
        })(i));
        northContainer.appendChild(cell);
    }
    
    // Cases SUD (affichées de 1 à 7)
    const southContainer = document.getElementById('southCells');
    southContainer.innerHTML = '';
    for (let i = 0; i < 7; i++) {
        const cell = document.createElement('div');
        cell.className = 'cell';
        cell.id = `sud-${i}`;
        cell.innerHTML = `
            <div class="cell-number">Case ${i+1}</div>
            <div class="cell-seeds">5</div>
        `;
        cell.addEventListener('click', (function(idx) {
            return function() { sendMove(idx); };
        })(i));
        southContainer.appendChild(cell);
    }
}

// Initialisation au chargement de la page
document.addEventListener('DOMContentLoaded', () => {
    createBoard();
    joinGame();
    
    document.getElementById('resetButton').addEventListener('click', () => {
        resetGame();
    });
});