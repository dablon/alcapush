import chalk from 'chalk';
import { type SpinnerName } from 'cli-spinners'; // Type definition if needed, or just object structure

// Define the shape of an ora spinner object
interface OraSpinner {
    interval: number;
    frames: string[];
}

export const getPacmanSpinner = (): OraSpinner => {
    const width = 35; // Visible play area width (increased for larger animation)
    const frames: string[] = [];

    // Characters
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

    // Helper function to generate random pellet position
    const getRandomPelletPos = (minDistance: number = 5): number => {
        return Math.floor(Math.random() * (width - minDistance)) + minDistance;
    };

    // Animation state
    let pacmanPos = 0;
    let pelletPos = getRandomPelletPos();
    let frameCount = 0;
    const totalFrames = 100; // Generate 100 frames for a looping animation

    for (let i = 0; i < totalFrames; i++) {
        let track = '';

        // Calculate ghost positions (following Pac-Man)
        const ghostRedPos = Math.max(0, pacmanPos - 2);
        const ghostPinkPos = Math.max(0, pacmanPos - 4);
        const ghostCyanPos = Math.max(0, pacmanPos - 6);
        const ghostOrangePos = Math.max(0, pacmanPos - 8);

        // Build the track for this frame
        for (let x = 0; x < width; x++) {
            if (x === pacmanPos) {
                // Alternate Pac-Man's mouth
                track += (frameCount % 2 === 0) ? cPacmanOpen : cPacmanClosed;
            } else if (x === ghostRedPos && pacmanPos > 2) {
                track += cGhostRed;
            } else if (x === ghostPinkPos && pacmanPos > 4) {
                track += cGhostPink;
            } else if (x === ghostCyanPos && pacmanPos > 6) {
                track += cGhostCyan;
            } else if (x === ghostOrangePos && pacmanPos > 8) {
                track += cGhostOrange;
            } else if (x === pelletPos) {
                // Show the target pellet
                track += cPellet;
            } else if (x < pacmanPos) {
                // Trail of small dots behind Pac-Man (where he's been)
                track += cDot;
            } else {
                // Empty space ahead
                track += ' ';
            }
        }

        frames.push(`${cWallL} ${track} ${cWallR}`);
        frameCount++;

        // Move Pac-Man towards the pellet
        if (pacmanPos < pelletPos) {
            pacmanPos++;
        } else if (pacmanPos === pelletPos) {
            // Pac-Man ate the pellet! Reset to beginning and spawn new pellet
            pacmanPos = 0;
            pelletPos = getRandomPelletPos();
        }
    }

    // Return the config object compatible with ora
    return {
        interval: 100,
        frames: frames
    };
};
