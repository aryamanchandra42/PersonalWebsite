document.addEventListener('DOMContentLoaded', () => {
    // Game State
    let gameActive = false;
    let currentRound = 1;
    let maxRounds = 20;
    let turnTimeLimit = 7;
    let userScore = 0;
    let computerScore = 0;
    let lastWord = null;
    let isUserTurn = true;
    let wordHistoryData = []; // Track all words with their data for graph visualization
    let gameEndedByTimeout = false; // Track if game ended due to timeout
    let userStreak = 0; // Track consecutive high scores

    // Staging for "Latest Computer Word"
    let pendingComputerEntry = null;

    // DOM Elements
    const startBtn = document.getElementById('start-btn');
    const restartBtn = document.getElementById('restart-btn');
    const gameIntro = document.getElementById('game-intro');
    const gameActiveSection = document.getElementById('game-active');
    const gameOver = document.getElementById('game-over');
    const wordInput = document.getElementById('word-input');
    const submitBtn = document.getElementById('submit-btn');
    const errorMsg = document.getElementById('error-msg');
    const timerDisplay = document.getElementById('timer-display');
    const wordHistory = document.getElementById('word-history');
    const turnIndicator = document.getElementById('turn-indicator');
    const mathPanel = document.getElementById('math-panel');

    // New Computer Move Elements
    const activeComputerDiv = document.getElementById('active-computer-move');
    const compWordDisplay = document.getElementById('comp-word-display');
    const compMeaningDisplay = document.getElementById('comp-meaning-display');
    const compDistanceDisplay = document.getElementById('comp-distance-display');

    const distanceDisplay = document.getElementById('distance-display');
    const fxContainer = document.getElementById('fx-container');
    const urgentVignette = document.getElementById('urgent-vignette');

    // Score displays
    const roundNumber = document.getElementById('round-number');
    const userScoreDisplay = document.getElementById('user-score');
    const computerScoreDisplay = document.getElementById('computer-score');

    // Settings Elements
    const settingsBtn = document.getElementById('settings-btn');
    const settingsPanel = document.getElementById('settings-panel');
    const timeInput = document.getElementById('time-setting');
    const roundsInput = document.getElementById('rounds-setting');
    const timeVal = document.getElementById('time-val');
    const roundsVal = document.getElementById('rounds-val');

    // Init Settings Values
    if (timeInput && roundsInput) {
        timeInput.value = turnTimeLimit;
        roundsInput.value = maxRounds;
        timeVal.textContent = turnTimeLimit + 's';
        roundsVal.textContent = maxRounds;

        // Listeners for Settings
        settingsBtn.addEventListener('click', () => {
            settingsPanel.classList.toggle('active');
        });

        timeInput.addEventListener('input', (e) => {
            turnTimeLimit = parseInt(e.target.value);
            timeVal.textContent = turnTimeLimit + 's';
            // Update timer display if game not active or just prep
            if (!gameActive) {
                timerDisplay.textContent = turnTimeLimit;
            }
        });

        roundsInput.addEventListener('input', (e) => {
            maxRounds = parseInt(e.target.value);
            roundsVal.textContent = maxRounds;
        });
    }

    // Timer state
    let timerInterval = null;
    let timeRemaining = turnTimeLimit;

    // Start Game
    startBtn.addEventListener('click', startGame);
    restartBtn.addEventListener('click', resetGame);

    function startGame() {
        gameActive = true;
        gameIntro.style.display = 'none';
        gameActiveSection.style.display = 'grid'; // Ensure grid layout
        isUserTurn = true;
        updateTurnIndicator();
        startTimer();
    }

    function resetGame() {
        gameActive = false;
        currentRound = 1;
        userScore = 0;
        computerScore = 0;
        lastWord = null;
        isUserTurn = true;
        wordHistoryData = [];
        pendingComputerEntry = null; // Clear pending
        gameEndedByTimeout = false;

        wordHistory.innerHTML = '';
        if (activeComputerDiv) activeComputerDiv.classList.add('hidden'); // Hide featured card

        wordInput.value = '';
        errorMsg.textContent = '';
        mathPanel.classList.remove('active');
        stopTimer();

        updateScoreDisplay();

        gameOver.style.display = 'none';
        gameIntro.style.display = 'block';
        gameActiveSection.style.display = 'none';

        // Remove analysis table if exists
        const analysis = gameOver.querySelector('.analysis-container');
        if (analysis) analysis.remove();
    }

    function updateTurnIndicator() {
        if (isUserTurn) {
            turnIndicator.innerHTML = '<i class="fas fa-user"></i><span>Your Turn</span>';
            turnIndicator.classList.remove('computer-turn');
        } else {
            turnIndicator.innerHTML = '<i class="fas fa-robot"></i><span>Computer\'s Turn</span>';
            turnIndicator.classList.add('computer-turn');
        }
    }

    function updateScoreDisplay() {
        roundNumber.textContent = currentRound;
        userScoreDisplay.textContent = userScore.toFixed(2);
        computerScoreDisplay.textContent = computerScore.toFixed(2);
    }

    // Handle Enter Key - submit word directly
    wordInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && gameActive && isUserTurn) {
            e.preventDefault();
            submitWord();
        }
    });

    // Submit Word
    submitBtn.addEventListener('click', () => {
        if (gameActive && isUserTurn) {
            submitWord();
        }
    });

    async function submitWord() {
        if (!gameActive || !isUserTurn) return;

        const word = wordInput.value.toLowerCase().trim();
        if (!word) return;

        stopTimer();
        errorMsg.textContent = '';

        try {
            // First validate the word exists
            const validateResponse = await fetch('/api/distance', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ word1: word, word2: word })
            });

            const validateData = await validateResponse.json();

            if (validateData.error) {
                errorMsg.textContent = validateData.error;
                startTimer(); // Restart timer if word is invalid
                return;
            }

            // Word is valid
            // Commit any pending computer word to history NOW
            if (pendingComputerEntry) {
                addWordToHistory(
                    pendingComputerEntry.word,
                    'computer',
                    pendingComputerEntry.distance,
                    pendingComputerEntry.meaning
                );
                // We keep it visible in the "featured" card until the computer moves again? 
                // The user request says "eventually go into log only on next turn".
                // So now it's in log. Should we hide the featured card?
                // Visual preference: maybe hide it to show we are processing?
                // Or leave it. Let's leave it for now, it will be replaced by next computer move.
                pendingComputerEntry = null;
            }

            // Word is valid, now calculate distance if not first word
            if (lastWord) {
                const response = await fetch('/api/distance', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ word1: lastWord, word2: word })
                });

                const data = await response.json();

                if (data.error) {
                    errorMsg.textContent = data.error;
                    startTimer();
                    return;
                }

                // Add to user score
                userScore += data.distance;
                updateScoreDisplay();

                // Visual Effects
                showFloatingText(`+${data.distance.toFixed(3)}`, userScoreDisplay, 'success');
                if (data.distance > 0.8) {
                    userStreak++;
                    if (userStreak >= 2) {
                        triggerConfetti();
                        showFloatingText(`Streak! ${userStreak}x`, userScoreDisplay, 'success');

                        // Speed Bonus: Answer in < 2s during streak
                        if ((turnTimeLimit - timeRemaining) < 2) {
                            userScore += 0.3;
                            updateScoreDisplay();
                            setTimeout(() => {
                                showFloatingText(`⚡ Speed Bonus! +0.3`, userScoreDisplay, 'success');
                            }, 300);
                        }
                    }
                } else {
                    userStreak = 0;
                }

                // Display word with distance
                addWordToHistory(word, 'user', data.distance, null, data.best_move);
                showDistance(data.distance);
            } else {
                // First word - no distance
                addWordToHistory(word, 'user', null, null);
            }

            lastWord = word;
            wordInput.value = '';

            // Computer's turn
            isUserTurn = false;
            updateTurnIndicator();

            setTimeout(() => {
                computerMove();
            }, 1500);

        } catch (err) {
            console.error(err);
            errorMsg.textContent = "An error occurred.";
            startTimer();
        }
    }

    async function computerMove() {
        if (!gameActive) return;

        try {
            const response = await fetch('/api/computer-move', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ word: lastWord })
            });

            const data = await response.json();

            if (data.error) {
                console.error(data.error);
                return;
            }

            // Add to computer score
            computerScore += data.distance;
            updateScoreDisplay();

            // Visual Effects
            showFloatingText(`+${data.distance.toFixed(3)}`, computerScoreDisplay, 'computer');

            // --- CHANGED: Don't add to history list yet ---
            // Display in the "Active Computer Move" card
            if (activeComputerDiv) {
                activeComputerDiv.classList.remove('hidden');
                compWordDisplay.textContent = data.word;
                compMeaningDisplay.textContent = data.meaning || '...';
                compDistanceDisplay.textContent = `Distance: ${data.distance.toFixed(4)}`;
            }

            // Store for next turn
            pendingComputerEntry = {
                word: data.word,
                distance: data.distance,
                meaning: data.meaning
            };

            showDistance(data.distance);

            lastWord = data.word;

            // Check if game is over
            if (currentRound >= maxRounds) {
                setTimeout(() => {
                    // If game ends, make sure to flush the pending move to history?
                    if (pendingComputerEntry) {
                        addWordToHistory(pendingComputerEntry.word, 'computer', pendingComputerEntry.distance, pendingComputerEntry.meaning);
                        pendingComputerEntry = null;
                    }
                    endGame();
                }, 2000);
            } else {
                currentRound++;
                updateScoreDisplay();

                // User's turn
                isUserTurn = true;
                updateTurnIndicator();
                startTimer();
            }

        } catch (err) {
            console.error(err);
        }
    }

    function addWordToHistory(word, player, distance, meaning = null, bestMove = null) {
        // Store data for graph visualization
        wordHistoryData.push({
            word: word,
            player: player,
            distance: distance,
            meaning: meaning,
            bestMove: bestMove
        });

        const entry = document.createElement('div');
        entry.className = 'word-entry';

        let distanceHTML = '';
        if (distance !== null) {
            distanceHTML = `
                <div class="word-distance">
                    <span>Distance:</span>
                    <span class="distance-badge">${distance.toFixed(4)}</span>
                </div>
            `;
        }

        let meaningHTML = '';
        if (meaning) {
            meaningHTML = `
                <div class="word-meaning">
                    <span class="meaning-label">Meaning:</span>
                    <span class="meaning-text">${meaning}</span>
                </div>
            `;
        }

        entry.innerHTML = `
            <div class="word-entry-header">
                <span class="word-player ${player}">${player === 'user' ? 'You' : 'Computer'}</span>
            </div>
            <div class="word-text">${word}</div>
            ${meaningHTML}
            ${distanceHTML}
        `;

        wordHistory.insertBefore(entry, wordHistory.firstChild);
    }

    function showDistance(distance) {
        mathPanel.classList.add('active');
        const distanceValue = distanceDisplay.querySelector('.distance-value');
        distanceValue.textContent = distance.toFixed(4);
    }

    function endGame() {
        gameActive = false;
        stopTimer();
        gameActiveSection.style.display = 'none';
        gameOver.style.display = 'block';

        document.getElementById('final-user-score').textContent = userScore.toFixed(2);
        document.getElementById('final-computer-score').textContent = computerScore.toFixed(2);

        const resultText = document.getElementById('game-result');
        // Check if game ended due to timeout
        if (gameEndedByTimeout) {
            resultText.textContent = 'Time\'s Up! You Lost!';
            resultText.style.color = 'var(--danger)';
        } else if (userScore > computerScore) {
            resultText.textContent = 'You Win! 🎉';
            resultText.style.color = 'var(--success)';
        } else if (computerScore > userScore) {
            resultText.textContent = 'Computer Wins!';
            resultText.style.color = 'var(--secondary)';
        } else {
            resultText.textContent = 'It\'s a Tie!';
            resultText.style.color = 'var(--text-main)';
        }

        // Generate Analysis Table
        const analysisContainer = document.createElement('div');
        analysisContainer.className = 'analysis-container';

        // Find best user play
        let bestUserPlay = null;
        let maxUserDist = -1;
        wordHistoryData.forEach(item => {
            if (item.player === 'user' && item.distance !== null) {
                if (item.distance > maxUserDist) {
                    maxUserDist = item.distance;
                    bestUserPlay = item;
                }
            }
        });

        let html = '';
        if (bestUserPlay) {
            html += `
                <div class="best-play-summary">
                    <span class="summary-label">Your Top Play</span>
                    <span class="summary-word">${bestUserPlay.word}</span>
                    <span class="summary-score">
                        ${bestUserPlay.distance.toFixed(3)}
                        <i class="fas fa-star" style="font-size: 0.7em; vertical-align: middle;"></i>
                    </span>
                </div>
            `;
        }

        html += `
            <table class="analysis-table">
                <thead>
                    <tr>
                        <th>Round</th>
                        <th>Your Move</th>
                        <th>Score</th>
                        <th>Best Move</th>
                        <th>Max Score</th>
                    </tr>
                </thead>
                <tbody>
        `;

        let moveCount = 0;
        let round = 1;
        // Iterate backwards to show round 1 at top? No wordHistoryData is time-ordered
        wordHistoryData.forEach(item => {
            if (item.player === 'user' && item.distance !== null && item.bestMove) {
                const diff = (item.bestMove.distance - item.distance);
                const diffClass = diff < 0.1 ? 'diff-positive' : 'diff-negative';

                html += `
                    <tr>
                        <td>${round}</td>
                        <td>${item.word}</td>
                        <td>${item.distance.toFixed(3)}</td>
                        <td class="best-move-col">${item.bestMove.word}</td>
                        <td>
                            ${item.bestMove.distance.toFixed(3)}
                            ${diff > 0.001 ? `<span class="missed-opportunity">(-${diff.toFixed(3)})</span>` : ''}
                        </td>
                    </tr>
                `;
                round++;
                moveCount++;
            }
        });

        html += '</tbody></table>';

        if (moveCount > 0) {
            analysisContainer.innerHTML = html;
            const restartBtn = document.getElementById('restart-btn');
            gameOver.insertBefore(analysisContainer, restartBtn);
        }

        // Create graph visualization
        createGraphVisualization();
    }

    async function createGraphVisualization() {
        if (wordHistoryData.length < 2) {
            return; // Need at least 2 words for a graph
        }

        const container = document.getElementById('graph-network');
        if (!container) return;

        // Calculate all pairwise distances
        const nodes = [];
        const edges = [];
        const nodeMap = new Map();

        // Create nodes
        wordHistoryData.forEach((item, index) => {
            const nodeId = index;
            nodeMap.set(item.word, nodeId);
            nodes.push({
                id: nodeId,
                label: item.word,
                color: {
                    background: item.player === 'user' ? '#1e40af' : '#9f1239',
                    border: item.player === 'user' ? '#1e3a8a' : '#881337',
                    highlight: { background: '#15803d', border: '#166534' }
                },
                font: { color: '#111111', size: 13, face: 'Crimson Text' },
                shape: 'dot',
                size: 18,
                borderWidth: 2
            });
        });

        // Calculate distances for all pairs using batch endpoint (much faster)
        const pairs = [];
        const pairIndices = [];
        for (let i = 0; i < wordHistoryData.length; i++) {
            for (let j = i + 1; j < wordHistoryData.length; j++) {
                pairs.push({
                    word1: wordHistoryData[i].word,
                    word2: wordHistoryData[j].word
                });
                pairIndices.push({ i, j });
            }
        }

        let distanceResults = [];
        try {
            const response = await fetch('/api/distances-batch', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ pairs: pairs })
            });
            const data = await response.json();
            if (data.results) {
                distanceResults = data.results.map((result, idx) => ({
                    i: pairIndices[idx].i,
                    j: pairIndices[idx].j,
                    distance: result.distance
                }));
            }
        } catch (err) {
            console.error('Error fetching batch distances:', err);
        }

        // Create edges
        // Primary edges: sequence path (consecutive words)
        for (let i = 0; i < wordHistoryData.length - 1; i++) {
            const distance = wordHistoryData[i + 1].distance;
            if (distance !== null) {
                edges.push({
                    from: i,
                    to: i + 1,
                    value: distance,
                    length: 100 + (1 - distance) * 200,
                    width: 2,
                    color: { color: '#334155', highlight: '#15803d' },
                    label: distance.toFixed(3),
                    font: { size: 10, color: '#6b7280' }
                });
            }
        }

        // Secondary edges: all other pairs (lighter/thinner)
        distanceResults.forEach(({ i, j, distance }) => {
            if (distance !== null && Math.abs(i - j) > 1) {
                edges.push({
                    from: i,
                    to: j,
                    value: distance,
                    length: 100 + (1 - distance) * 300,
                    width: 1,
                    color: { color: '#cbd5e1', highlight: '#334155' },
                    dashes: [4, 4]
                });
            }
        });

        const data = {
            nodes: new vis.DataSet(nodes),
            edges: new vis.DataSet(edges)
        };

        const options = {
            nodes: {
                borderWidth: 1,
                shadow: false
            },
            edges: {
                smooth: {
                    type: 'continuous',
                    roundness: 0.5
                },
                arrows: {
                    to: {
                        enabled: false
                    }
                },
                physics: false
            },
            physics: {
                enabled: true,
                stabilization: {
                    enabled: true,
                    iterations: 200
                },
                barnesHut: {
                    gravitationalConstant: -2000,
                    centralGravity: 0.1,
                    springLength: 150,
                    springConstant: 0.04,
                    damping: 0.09
                }
            },
            interaction: {
                zoomView: true,
                dragView: true,
                hover: true
            }
        };

        const network = new vis.Network(container, data, options);

        // Add hover tooltip
        network.on('hoverNode', function (params) {
            const index = params.node;
            const wordData = wordHistoryData[index];
            if (wordData && wordData.meaning) {
                container.title = wordData.meaning;
            }
        });
    }

    // Timer functions
    function startTimer() {
        stopTimer(); // Clear any existing timer
        timeRemaining = turnTimeLimit;
        updateTimerDisplay();

        if (!gameActive || !isUserTurn) return;

        timerInterval = setInterval(() => {
            timeRemaining--;
            updateTimerDisplay();

            if (timeRemaining <= 0) {
                stopTimer();
                // Time's up - auto-submit a random word
                autoSubmitRandomWord();
            }
        }, 1000);
    }

    function stopTimer() {
        if (timerInterval) {
            clearInterval(timerInterval);
            timerInterval = null;
        }
    }

    function updateTimerDisplay() {
        if (timerDisplay) {
            timerDisplay.textContent = timeRemaining;

            // Urgency effects (Subtle text color change only now)
            if (timeRemaining <= 3) {
                timerDisplay.classList.add('timer-urgent');
                if (urgentVignette) urgentVignette.classList.add('active');
            } else {
                timerDisplay.classList.remove('timer-urgent');
                if (urgentVignette) urgentVignette.classList.remove('active');
            }
        }
    }

    function autoSubmitRandomWord() {
        if (!gameActive || !isUserTurn) return;

        // Time's up - player loses
        gameEndedByTimeout = true;
        errorMsg.textContent = "Time's up! You lost!";
        setTimeout(() => {
            endGame();
        }, 1000);
    }

    // Visual Effects Helpers
    function showFloatingText(text, targetElement, type = 'success') {
        const rect = targetElement.getBoundingClientRect();
        const el = document.createElement('div');
        el.className = 'floating-text';
        el.textContent = text;

        // Randomize start position slightly
        const randomX = (Math.random() - 0.5) * 40;

        el.style.left = `${rect.left + rect.width / 2 + randomX}px`;
        el.style.top = `${rect.top}px`;

        if (type === 'computer') {
            el.style.color = '#c084fc';
        }

        fxContainer.appendChild(el);

        // Cleanup
        setTimeout(() => el.remove(), 1500);
    }

    function triggerConfetti() {
        const colors = ['#6366f1', '#34d399', '#f472b6', '#fbbf24'];
        const count = 30;
        const centerX = window.innerWidth / 2;
        const centerY = window.innerHeight / 2;

        for (let i = 0; i < count; i++) {
            const el = document.createElement('div');
            el.className = 'particle';

            const color = colors[Math.floor(Math.random() * colors.length)];
            el.style.backgroundColor = color;

            // Random start position near center
            const startX = centerX + (Math.random() - 0.5) * 50;
            const startY = centerY + (Math.random() - 0.5) * 50;

            el.style.left = `${startX}px`;
            el.style.top = `${startY}px`;

            // Random trajectory
            const angle = Math.random() * Math.PI * 2;
            const velocity = 100 + Math.random() * 200;

            const tx = Math.cos(angle) * velocity;
            const ty = Math.sin(angle) * velocity;

            el.style.setProperty('--tx', `${tx}px`);
            el.style.setProperty('--ty', `${ty}px`);

            fxContainer.appendChild(el);

            setTimeout(() => el.remove(), 1000);
        }
    }

    // ===== Ancient Scroll Overlay Controls =====
    const scrollTrigger = document.getElementById('scroll-trigger');
    const scrollOverlay = document.getElementById('scroll-overlay');
    const scrollClose = document.getElementById('scroll-close');
    const scrollContainer = document.getElementById('scroll-container');
    const scrollContent = document.getElementById('scroll-content');

    if (scrollTrigger && scrollOverlay) {
        // Open scroll
        scrollTrigger.addEventListener('click', () => {
            scrollOverlay.classList.add('active');
            document.body.style.overflow = 'hidden';

            // Reset section animations when opening
            const sections = scrollContent.querySelectorAll('.scroll-section');
            sections.forEach(section => {
                section.style.animation = 'none';
                section.offsetHeight; // Trigger reflow
                section.style.animation = '';
            });
        });

        // Close scroll
        function closeScroll() {
            scrollOverlay.classList.remove('active');
            document.body.style.overflow = '';
        }

        scrollClose.addEventListener('click', closeScroll);

        // Close on backdrop click
        scrollOverlay.addEventListener('click', (e) => {
            if (e.target === scrollOverlay) {
                closeScroll();
            }
        });

        // Close on ESC key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && scrollOverlay.classList.contains('active')) {
                closeScroll();
            }
        });
    }

    // ===== Background Music Controls =====
    const bgMusic = document.getElementById('bg-music');
    const musicToggle = document.getElementById('music-toggle');
    const musicIcon = document.getElementById('music-icon');

    if (bgMusic && musicToggle) {
        // Set initial volume (light ambient)
        bgMusic.volume = 0.3;
        let isMuted = true;

        musicToggle.addEventListener('click', () => {
            if (isMuted) {
                // Start playing
                bgMusic.play().then(() => {
                    isMuted = false;
                    musicToggle.classList.add('playing');
                    musicIcon.className = 'fas fa-volume-up';

                    // Fade in volume
                    bgMusic.volume = 0;
                    let vol = 0;
                    const fadeIn = setInterval(() => {
                        vol += 0.05;
                        if (vol >= 0.3) {
                            bgMusic.volume = 0.3;
                            clearInterval(fadeIn);
                        } else {
                            bgMusic.volume = vol;
                        }
                    }, 100);
                }).catch(err => {
                    console.log('Audio autoplay blocked:', err);
                });
            } else {
                // Mute
                bgMusic.pause();
                isMuted = true;
                musicToggle.classList.remove('playing');
                musicIcon.className = 'fas fa-volume-mute';
            }
        });
    }
});
