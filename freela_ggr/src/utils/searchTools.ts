
export function normalize(value: string) { 
    return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim(); 
}

export function distance(first: string, second: string) {
    const matrix = Array.from({ length: second.length + 1 }, (_, row) => 
        Array.from({ length: first.length + 1 }, (_, column) => 
        (row === 0 ? column : column === 0 ? row : 0)
    )
    );
    
    for (let row = 1; row <= second.length; row += 1) {
    for (let column = 1; column <= first.length; column += 1) {
        matrix[row][column] = Math.min(
        matrix[row - 1][column] + 1, 
        matrix[row][column - 1] + 1, 
        matrix[row - 1][column - 1] + (second[row - 1] === first[column - 1] ? 0 : 1)
        );
    }
    }
    return matrix[second.length][first.length];
}
