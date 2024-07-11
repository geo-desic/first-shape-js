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
        this.endConditions = [];
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

class FsEndCondition {
    constructor() {
        this.locations = [];
        this.firstPieceToFill = null;
        this.blocked = false;
        this.fillCount = 0;
    }
}

class FsGame {
    constructor(board, shapes, isMisere = false) {
        this.board = board;
        this.endCondition = null;
        this.endConditions = [];
        this.isMisere = isMisere;
        this.moves = [];
        this.pieceToMove = 1;
        this.shapes = shapes;
        this.state = -1; // -1: in progress; 0: draw; 1: player 1 won; 2: player 2 won
        for (let shape of shapes) {
            for (let r = 0; r < board.rows - shape.rows + 1; r++) {
                for (let c = 0; c < board.columns - shape.columns + 1; c++) {
                    let endCondition = new FsEndCondition();
                    for (let rs = 0; rs < shape.rows; rs++) {
                        for (let cs = 0; cs < shape.columns; cs++) {
                            if (shape.locations[rs][cs] === true) {
                                let loc = board.locations[r + rs][c + cs];
                                loc.endConditions.push(endCondition);
                                endCondition.locations.push(loc);
                            }
                        }
                    }
                    this.endConditions.push(endCondition);
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
            let endConditionReached = false;
            for (let endCondition of loc.endConditions) {
                endCondition.fillCount++;
                if (endCondition.fillCount === 1) {
                    endCondition.firstPieceToFill = this.pieceToMove;
                } else if (endCondition.firstPieceToFill === this.pieceToMove) {
                    if (!endCondition.blocked && endCondition.fillCount === endCondition.locations.length) {
                        endConditionReached = true;
                        this.endCondition = endCondition;
                    }
                } else {
                    endCondition.blocked = true;
                }
            }
            let nextPieceToMove = (this.pieceToMove >= 2) ? 1 : this.pieceToMove + 1;
            if (endConditionReached) {
                this.state = this.isMisere ? nextPieceToMove : this.pieceToMove;
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
