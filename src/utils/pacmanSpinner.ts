import chalk from 'chalk';
import { type SpinnerName } from 'cli-spinners'; // Type definition if needed, or just object structure

// Define the shape of an ora spinner object
interface OraSpinner {
    interval: number;
    frames: string[];
}

export const getPacmanSpinner = (): OraSpinner => {
    const width = 20; // Visible play area width
    const frames: string[] = [];

    // Animation Sequence Configuration
    const totalSteps = width + 12; // Run full length + buffer for entities to exit

    // Characters
    // Using simple chars for maximum compatibility + colors
    const cWallL = chalk.blue('▐');
    const cWallR = chalk.blue('▌');
    const cPacmanOpen = chalk.yellow('ᗧ');
    const cPacmanClosed = chalk.yellow('O');
    const cGhostRed = chalk.red('ᗣ');
    const cGhostPink = chalk.magenta('ᗣ');
    const cGhostCyan = chalk.cyan('ᗣ');
    const cGhostOrange = chalk.rgb(255, 165, 0)('ᗣ');
    const cDot = chalk.gray('•');
    const cPellet = chalk.white('●');

    for (let i = 0; i < totalSteps; i++) {
        let track = '';

        // Pacman moves from left to right (0 -> width)
        // Ghosts follow

        // Calculate positions
        const pacmanPos = i;
        const ghostRedPos = i - 2;
        const ghostPinkPos = i - 4;
        const ghostCyanPos = i - 6;
        const ghostOrangePos = i - 8;

        for (let x = 0; x < width; x++) {
            if (x === pacmanPos) {
                track += (i % 2 === 0) ? cPacmanOpen : cPacmanClosed;
            } else if (x === ghostRedPos) {
                track += cGhostRed;
            } else if (x === ghostPinkPos) {
                track += cGhostPink;
            } else if (x === ghostCyanPos) {
                track += cGhostCyan;
            } else if (x === ghostOrangePos) {
                track += cGhostOrange;
            } else {
                // Scenery
                if (x > pacmanPos) {
                    if (x === width - 2) {
                        track += cPellet;
                    } else {
                        track += cDot;
                    }
                } else {
                    track += ' '; // Empty space behind (eaten)
                }
            }
        }

        // Single line frame:  ▐ • • ᗧ ᗣ • ▌
        frames.push(`${cWallL} ${track} ${cWallR}`);
    }

    // Return the config object compatible with ora
    return {
        interval: 100,
        frames: frames
    };
};
