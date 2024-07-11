const AI_AI_DELAY_MS = 500;
const EVALUATION_EPSILON = 0.25;
const LOCATION_ID_PREFIX = "fs_loc_";
const PIECE_DISPLAY = ["", "X", "O"];
var currentGame = null;
var modelTtt = null;
var modelTtt4 = null;
var preventUserActions = false;

class Game {
    constructor(gameType, isMisere, isAiPlayer1, isAiPlayer2) {
        this.gameType = gameType;
        this.isMisere = isMisere;
        this.isAiPlayer1 = isAiPlayer1;
        this.isAiPlayer2 = isAiPlayer2;
        if (gameType === "ttt") {
            this.fsGame = new FsGame(new FsBoard(3, 3), [new FsLineDiagonal1(3), new FsLineDiagonal2(3), new FsLineHorizontal(3), new FsLineVertical(3)], isMisere);
        } else if (gameType === "ttt_4") {
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
        let boardArray = boardToArray();
        for (let r = 0; r < board.rows; r++) {
            for (let c = 0; c < board.columns; c++) {
                if (fsGame.validMove(r, c)) {
                    let i = board.columns * r + c;
                    boardArray[i] = this.piece;
                    let modelInput = boardArrayToModelInput(boardArray);
                    let evaluation = this.model.predict(modelInput).dataSync()[0];
                    modelInput.dispose();
                    if (currentGame.gameType === "ttt") {
                        evaluation = Math.round(evaluation);
                    }
                    boardArray[i] = 0;
                    if (this.piece === 2) { evaluation = -evaluation; }
                    movesAndEvals.push([r, c, evaluation]);
                    if (bestEvaluation === null || evaluation > bestEvaluation) {
                        bestEvaluation = evaluation;
                    }
                }
            }
        }
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
    if (isMisere) return null;
    if (gameType === "ttt") return modelTtt;
    if (gameType === "ttt_4") return modelTtt4;
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

function boardToArray() {
    let result = [];
    let board = currentGame.fsGame.board;
    for (let r = 0; r < board.rows; r++) {
        for (let c = 0; c < board.columns; c++) {
            let piece = board.locations[r][c].piece;
            if (piece === null) { piece = 0; }
            result.push(piece);
        }
    }
    return result;
}

function boardArrayToModelInput(boardArray) {
    return tf.tensor(boardArray, [1, currentGame.fsGame.board.size()]);
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

async function loadModelsAsync() {
    modelTtt = await tf.loadLayersModel("ttt_model/model.json");
    modelTtt4 = await tf.loadLayersModel("ttt_4_model/model.json");

    // warm up models
    const zeros9 = tf.zeros([1, 9]);
    const zeros16 = tf.zeros([1, 16]);
    modelTtt.predict(zeros9);
    modelTtt4.predict(zeros16);
    zeros9.dispose();
    zeros16.dispose();
}

(async () => {
    try
    {
        await loadModelsAsync();
    }
    catch {
        console.error("ai models could not be loaded");
    }

    document.getElementById("game_type").addEventListener('change', refreshSupportedAiConfigurations);
    document.getElementById("misere").addEventListener('change', refreshSupportedAiConfigurations);
    refreshSupportedAiConfigurations();
    newGame();
})();
