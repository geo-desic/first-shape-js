class FsShape {
    constructor(rows, columns, fillAll = false) {
        this.rows = rows;
        this.columns = columns;
        this.locations = new Array(rows);
        for (let r = 0; r < rows; r++) {
            this.locations[r] = new Array(columns);
        }
        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < columns; c++) {
                this.locations[r][c] = fillAll;
            }
        }
    }
}

class FsLineDiagonal1 extends FsShape { // diagonal line shaped like: \
    constructor(length) {
        super(length, length);
        for (let r = 0; r < this.rows; r++) {
            this.locations[r][r] = true;
        }
    }
}

class FsLineDiagonal2 extends FsShape { // diagonal line shaped like: /
    constructor(length) {
        super(length, length);
        for (let r = 0; r < this.rows; r++) {
            this.locations[this.rows - r - 1][r] = true;
        }
    }
}

class FsLineHorizontal extends FsShape {
    constructor(length) {
        super(1, length, true);
    }
}

class FsLineVertical extends FsShape {
    constructor(length) {
        super(length, 1, true);
    }
}

class FsSquare extends FsShape {
    constructor(length) {
        super(length, length, true);
    }
}

class FsLocation {
    constructor(row, column, piece = null) {
        this.column = column;
        this.piece = piece;
        this.row = row;
        this.winConditions = [];
    }
}

class FsBoard {
    constructor(rows, columns) {
        this.rows = rows;
        this.columns = columns;
        this.locations = new Array(rows);
        for (let r = 0; r < rows; r++) {
            this.locations[r] = new Array(columns);
        }
        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < columns; c++) {
                this.locations[r][c] = new FsLocation(r, c);
            }
        }
    }

    size() {
        return this.rows * this.columns;
    }
}

class FsWinCondition {
    constructor() {
        this.locations = [];
        this.firstPieceToFill = null;
        this.blocked = false;
        this.fillCount = 0;
    }
}

class FsGame {
    constructor(board, shapes) {
        this.board = board;
        this.moves = [];
        this.pieceToMove = 1;
        this.shapes = shapes;
        this.state = -1; // -1: in progress; 0: draw; 1: player 1 won; 2: player 2 won
        this.winConditions = [];
        this.winCondition = null;
        for (let shape of shapes) {
            for (let r = 0; r < board.rows - shape.rows + 1; r++) {
                for (let c = 0; c < board.columns - shape.columns + 1; c++) {
                    let winCondition = new FsWinCondition();
                    for (let rs = 0; rs < shape.rows; rs++) {
                        for (let cs = 0; cs < shape.columns; cs++) {
                            if (shape.locations[rs][cs] === true) {
                                let loc = board.locations[r + rs][c + cs];
                                loc.winConditions.push(winCondition);
                                winCondition.locations.push(loc);
                            }
                        }
                    }
                    this.winConditions.push(winCondition);
                }
            }
        }
    }

    move(row, column) {
        if (this.validMove(row, column)) {
            let loc = this.board.locations[row][column];
            loc.piece = this.pieceToMove;
            const move = { row: row, column: column };
            this.moves.push(move);
            let won = false;
            for (let winCondition of loc.winConditions) {
                winCondition.fillCount++;
                if (winCondition.fillCount === 1) {
                    winCondition.firstPieceToFill = this.pieceToMove;
                } else if (winCondition.firstPieceToFill === this.pieceToMove) {
                    if (!winCondition.blocked && winCondition.fillCount === winCondition.locations.length) {
                        won = true;
                        this.winCondition = winCondition;
                    }
                } else {
                    winCondition.blocked = true;
                }
            }
            if (won) {
                this.state = this.pieceToMove;
            } else if (this.moves.length === this.board.size()) {
                this.state = 0; // draw
            }
            this.pieceToMove++;
            if (this.pieceToMove > 2) { this.pieceToMove = 1; }
        }
    }

    validMove(row, column) {
        if (this.state === -1 && row >= 0 && column >= 0 && row < this.board.rows && column < this.board.columns && this.board.locations[row][column].piece === null) {
            return true;
        }
        return false;
    }
}
