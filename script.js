const AI_AI_DELAY_MS = 500;
const EVALUATION_EPSILON = 0.25;
const LOCATION_ID_PREFIX = "fs_loc_";
const PIECE_DISPLAY = ["", "X", "O"];
var currentGame = null;
const models = [];
var preventUserActions = false;

class ModelDetails {
    constructor(gameType, isMisere, inputSize, path) {
        this.gameType = gameType;
        this.isMisere = isMisere;
        this.inputSize = inputSize;
        this.path = path;
        this.model = null;
        this.modelLoaded = false;
    }
}

class Game {
    constructor(gameType, isMisere, isAiPlayer1, isAiPlayer2) {
        this.gameType = gameType;
        this.isMisere = isMisere;
        this.isAiPlayer1 = isAiPlayer1;
        this.isAiPlayer2 = isAiPlayer2;
        if (gameType === "3x3l") {
            this.fsGame = new FsGame(new FsBoard(3, 3), [new FsLineDiagonal1(3), new FsLineDiagonal2(3), new FsLineHorizontal(3), new FsLineVertical(3)], isMisere);
        } else if (gameType === "4x4ls") {
            this.fsGame = new FsGame(new FsBoard(4, 4), [new FsLineDiagonal1(4), new FsLineDiagonal2(4), new FsLineHorizontal(4), new FsLineVertical(4), new FsSquare(2)], isMisere);
        } else {
            throw "Unsupported game type";
        }
        this.aiPlayers = [null, null];
        let model = gameConfigurationModel(gameType, isMisere);
        if (isAiPlayer1 && model !== null) {
            this.aiPlayers[0] = new AiPlayer(model, 1);
        }
        if (isAiPlayer2 && model !== null) {
            this.aiPlayers[1] = new AiPlayer(model, 2);
        }
    }

    aiPlayer() {
        return this.aiPlayers[this.fsGame.pieceToMove - 1];
    }
}

class AiPlayer {
    constructor(model, piece) {
        this.model = model;
        this.piece = piece;
    }

    move() {
        let fsGame = currentGame.fsGame;
        if (fsGame.state >= 0) {
            throw "Game is not in progress";
        }
        if (fsGame.pieceToMove !== this.piece) {
            throw "Piece inconsistent with game's piece to move";
        }
        let board = fsGame.board;
        let bestEvaluation = null;
        let movesAndEvals = [];
        let modelInputArray = boardToModelInputArray();
        for (let r = 0; r < board.rows; r++) {
            for (let c = 0; c < board.columns; c++) {
                if (fsGame.validMove(r, c)) {
                    let i = board.columns * r + c;
                    // model input length is twice the number of board locations
                    // the first half is dedicated to the locations of the first players pieces and the second half player is for the second player
                    if (this.piece == 2) i += board.size();
                    modelInputArray[i] = 1; // temporarily fill to predict this move with the model
                    let tensor = modelInputArrayToTensor(modelInputArray);
                    let evaluation = this.model.predict(tensor).dataSync()[0];
                    tensor.dispose();
                    if (currentGame.gameType === "3x3l") {
                        // currently only the 3x3 models are perfect predictors (maximum error less than 0.5) so their predictions can safely be rounded
                        evaluation = Math.round(evaluation);
                    }
                    modelInputArray[i] = 0; // zero out the temporary move
                    if (this.piece === 2) { evaluation = -evaluation; } // scores are from the first players perspective but the second players scores are simply the negation
                    movesAndEvals.push([r, c, evaluation]);
                    if (bestEvaluation === null || evaluation > bestEvaluation) {
                        bestEvaluation = evaluation;
                    }
                }
            }
        }
        // instead of always picking the move with the highest score, choose from any that are within EVALUATION_EPSILON of the maximum score
        let lowCutoff = bestEvaluation - EVALUATION_EPSILON;
        let i = 0;
        while (i < movesAndEvals.length) {
            let item = movesAndEvals[i];
            if (item[2] < lowCutoff) {
                movesAndEvals.splice(i, 1);
            }
            else {
                i++;
            }
        }
        let randomIndex = Math.floor(Math.random() * movesAndEvals.length);
        let randomElement = movesAndEvals[randomIndex];
        return [randomElement[0], randomElement[1]];
    }
}

function gameConfigurationModel(gameType, isMisere) {
    for (let modelDetails of models) {
        if (modelDetails.gameType === gameType && modelDetails.isMisere === isMisere) return modelDetails.model;
    }
    return null;
}

function newGame() {
    if (!preventUserActions) {
        let boardContainer = document.getElementById("board_container");
        while (boardContainer.firstChild) {
            boardContainer.removeChild(boardContainer.lastChild);
        }
        refreshSupportedAiConfigurations();
        let gameType = document.getElementById("game_type").value;
        let isMisere = document.getElementById("misere").checked;
        let isAiPlayer1 = document.getElementById("ai_player_1").checked;
        let isAiPlayer2 = document.getElementById("ai_player_2").checked;
        currentGame = new Game(gameType, isMisere, isAiPlayer1, isAiPlayer2);

        let tableBoard = document.createElement("table");

        for (let r = 0; r < currentGame.fsGame.board.rows; r++) {
            let tableRow = document.createElement("tr");
            tableBoard.appendChild(tableRow);
            for (let c = 0; c < currentGame.fsGame.board.columns; c++) {
                let tableData = document.createElement("td");
                tableData.addEventListener("click", locationClicked);
                tableData.id = LOCATION_ID_PREFIX + r + "_" + c;
                tableData.setAttribute("data-row", r);
                tableData.setAttribute("data-column", c);
                tableRow.appendChild(tableData);
            }
        }
        boardContainer.appendChild(tableBoard);
        setPlayerToMove();
        performAiMoves();
    }
}

function locationClicked() {
    if (!preventUserActions) {
        let row = this.dataset.row;
        let column = this.dataset.column;
        let fsGame = currentGame.fsGame;
        if (currentGame.aiPlayer() === null && fsGame.validMove(row, column)) {
            let piece = fsGame.pieceToMove;
            fsGame.move(row, column);
            uiMove(piece, this);
            performAiMoves();
        }
    }
}

function uiMove(piece, locTd) {
    locTd.innerText = PIECE_DISPLAY[piece];
    let fsGame = currentGame.fsGame;
    if (fsGame.state >= 0) { // game finished
        if (fsGame.state === 0) {
            setGameInformation("Draw!");
        } else {
            for (let loc of fsGame.endCondition.locations) {
                let tableData = document.getElementById(LOCATION_ID_PREFIX + loc.row + "_" + loc.column);
                let classValue = fsGame.isMisere ? "loss" : "win";
                tableData.classList.add(classValue);
            }
            setGameInformation(PIECE_DISPLAY[fsGame.state] + " wins!");
        }
    } else { // game in progress
        setPlayerToMove();
    }
}

function boardToModelInputArray() {
    let result = [];
    let board = currentGame.fsGame.board;
    for (let p = 1; p <= 2; p++) {
        for (let r = 0; r < board.rows; r++) {
            for (let c = 0; c < board.columns; c++) {
                result.push(p === board.locations[r][c].piece ? 1 : 0)
            }
        }
    }
    return result;
}

function modelInputArrayToTensor(values) {
    return tf.tensor(values, [1, values.length]);
}

function performAiMoves() {
    let aiPlayer = currentGame.aiPlayer();
    if (aiPlayer !== null && currentGame.fsGame.state < 0) {
        let move = aiPlayer.move();
        currentGame.fsGame.move(move[0], move[1]);
        uiMove(aiPlayer.piece, document.getElementById(LOCATION_ID_PREFIX + move[0] + "_" + move[1]));
        if (currentGame.aiPlayer() !== null && currentGame.fsGame.state < 0) {
            preventUserActions = true;
            setTimeout(function () { preventUserActions = false; performAiMoves(); }, AI_AI_DELAY_MS);
        }
    }
}

function setGameInformation(value) {
    document.getElementById("game_information").innerText = value;
}

function setPlayerToMove() {
    setGameInformation("Player to move: " + PIECE_DISPLAY[currentGame.fsGame.pieceToMove]);
}

function refreshSupportedAiConfigurations() {
    let gameType = document.getElementById("game_type").value;
    let isMisere = document.getElementById("misere").checked;
    let aiPlayer1 = document.getElementById("ai_player_1");
    let aiPlayer2 = document.getElementById("ai_player_2");
    if (gameConfigurationModel(gameType, isMisere) === null) {
        aiPlayer1.disabled = true;
        aiPlayer2.disabled = true;
        aiPlayer1.checked = false;
        aiPlayer2.checked = false;
    }
    else {
        aiPlayer1.disabled = false;
        aiPlayer2.disabled = false;
    }
}

async function loadModelAsync(modelDetails) {
    try {
        modelDetails.modelLoaded = true;
        modelDetails.model = await tf.loadGraphModel(modelDetails.path);

        // warm up model
        const zeros = tf.zeros([1, modelDetails.inputSize]);
        modelDetails.model.predict(zeros);
        zeros.dispose();
    }
    catch(e) {
        console.error(`error loading tfjs model: gameType = ${modelDetails.gameType}, isMisere = ${modelDetails.isMisere}`);
        console.log(e.message);
    }
}

async function loadModelsAsync() {
    for (let modelDetails of models) {
        await loadModelAsync(modelDetails);
    }
}

(async () => {
    models.push(new ModelDetails("3x3l", false, 18, "models/fs-3x3-l/model.json"));    // 3x3 with lines
    models.push(new ModelDetails("3x3l", true, 18, "models/fs-3x3-l-m/model.json"));   // 3x3 with lines misere
    models.push(new ModelDetails("4x4ls", false, 32, "models/fs-4x4-ls/model.json"));  // 4x4 with lines and squares
    models.push(new ModelDetails("4x4ls", true, 32, "models/fs-4x4-ls-m/model.json")); // 4x4 with lines and squares misere

    await loadModelsAsync();

    document.getElementById("game_type").addEventListener('change', refreshSupportedAiConfigurations);
    document.getElementById("misere").addEventListener('change', refreshSupportedAiConfigurations);
    refreshSupportedAiConfigurations();
    newGame();
})();
