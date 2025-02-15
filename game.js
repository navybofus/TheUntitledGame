class TitleScene extends Phaser.Scene {
    constructor() {
        super({key: 'TitleScene'});
    }

    preload() {
        this.load.image('logo', './images/TitleScreen.png'); // Load your logo
    }

    create() {
        // Set the background color to a nice blue
        this.cameras.main.setBackgroundColor('#c6c3c0');

        const centerX = this.cameras.main.width / 2;
        const centerY = this.cameras.main.height / 2;

        // Add logo
        this.add.image(centerX, centerY, 'logo').setScale(0.8);

        // Create a start button
        const startButton = this.add.text(centerX, centerY + 310, 'Start Game', {
            fontSize: '32px',
            fontFamily: 'Arial',
            color: '#ffffff',
            backgroundColor: '#007bff',
            padding: {x: 20, y: 10},
        })
            .setOrigin(0.5)
            .setInteractive();

        // Button interaction
        startButton.on('pointerover', () => {
            startButton.setBackgroundColor('#0056b3');
        });

        startButton.on('pointerout', () => {
            startButton.setBackgroundColor('#007bff');
        });

        startButton.on('pointerdown', () => {
            this.scene.start('GameScene'); // Transition to the game scene (to be created later)
        });
    }
}

class GameScene extends Phaser.Scene {
    constructor() {
        super({ key: 'GameScene' });
        this.selectedCharacter = null;
        this.moveUsed = false;
        this.combatUsed = false;
        this.initiativeRemoved = false; // To track if initiative roll texts have been removed
    }

    create() {
        const gameWidth = this.cameras.main.width;
        const gameHeight = this.cameras.main.height;

        // -------------------------
        // Grid Settings
        // -------------------------
        const gridCols = 10;
        const gridRows = 6;
        const gridSize = 64; // Size of each cell (in pixels)
        const gridX = (gameWidth - gridCols * gridSize) / 2;
        const gridY = (gameHeight - gridRows * gridSize) / 2;

        // -------------------------
        // Character Class Definitions
        // -------------------------
        const classes = {
            Warrior: { color: 0xff0000, statResource: "Rage", moveRange: 3, combatRange: 1 },
            Mage: { color: 0x0000ff, statResource: "Mana", moveRange: 3, combatRange: 3 },
            Archer: { color: 0x00ff00, statResource: "Mana", moveRange: 4, combatRange: 3 }
        };

        // -------------------------
        // Player Colors
        // -------------------------
        const playerColors = {
            player1: 0xffff00, // Yellow
            player2: 0xaa00ff  // Purple
        };

        // -------------------------
        // Default Stats and Damage Settings
        // -------------------------
        const defaultStats = {
            HP: 100,
            EXP: 0,
            Damage: 10, // Not used directly for combat calculations
            defending: false
        };

        // Base damage values
        const baseDamageValues = {
            Warrior: 50,
            Archer: 30,
            MageLightning: 30,
            MageFire: 50
        };

        // Damage multipliers (attacker vs defender)
        const damageMultipliers = {
            Warrior: { Warrior: 1.0, Mage: 1.2, Archer: 0.8 },
            Mage: { Warrior: 0.8, Mage: 1.0, Archer: 1.2 },
            Archer: { Warrior: 1.2, Mage: 0.8, Archer: 1.0 }
        };

        // -------------------------
        // Occupied Positions Map
        // -------------------------
        // Keys are "col-row" for both obstacles and tokens.
        let occupiedPositions = new Map();

        // -------------------------
        // Utility Functions
        // -------------------------
        const getRandomPositionGeneric = () => {
            let col, row, key;
            do {
                col = Phaser.Math.Between(0, gridCols - 1);
                row = Phaser.Math.Between(0, gridRows - 1);
                key = `${col}-${row}`;
            } while (occupiedPositions.has(key));
            occupiedPositions.set(key, true);
            return { col, row, x: gridX + col * gridSize + gridSize / 2, y: gridY + row * gridSize + gridSize / 2 };
        };

        const getRandomTokenPosition = (minCol, maxCol) => {
            let col, row, key;
            do {
                col = Phaser.Math.Between(minCol, maxCol);
                row = Phaser.Math.Between(0, gridRows - 1);
                key = `${col}-${row}`;
            } while (occupiedPositions.has(key));
            occupiedPositions.set(key, true);
            return { col, row, x: gridX + col * gridSize + gridSize / 2, y: gridY + row * gridSize + gridSize / 2 };
        };

        // -------------------------
        // Draw the Grid
        // -------------------------
        this.gridCells = [];
        for (let row = 0; row < gridRows; row++) {
            for (let col = 0; col < gridCols; col++) {
                let cell = this.add.rectangle(
                    gridX + col * gridSize + gridSize / 2,
                    gridY + row * gridSize + gridSize / 2,
                    gridSize,
                    gridSize,
                    0x888888,
                    0.3
                ).setStrokeStyle(2, 0xffffff);
                this.gridCells.push({ col, row, cell });
            }
        }

        // -------------------------
        // Place Obstacles (Water & Rock)
        // -------------------------
        this.obstacles = [];
        const obstacleCount = 8;
        for (let i = 0; i < obstacleCount; i++) {
            let pos = getRandomPositionGeneric();
            let type = Phaser.Math.Between(0, 1) === 0 ? "water" : "rock";
            let color = (type === "water") ? 0x1e90ff : 0x808080;
            let obstacle = this.add.rectangle(
                pos.x,
                pos.y,
                gridSize,
                gridSize,
                color,
                0.7
            );
            this.obstacles.push({ pos, type, obstacle });
        }

        // -------------------------
        // Left Panel for Stats
        // -------------------------
        // Entire panel
        const leftPanel = this.add.rectangle(20, 50, 180, 400, 0x222222, 1)
            .setOrigin(0)
            .setStrokeStyle(2, 0xffffff);
        // Selected character stats background
        const selectedStatsBG = this.add.rectangle(30, 60, 160, 108, 0x000000, 0.5)
            .setOrigin(0)
            .setStrokeStyle(2, 0xffffff);
        // Hovered character stats background
        const hoverStatsBG = this.add.rectangle(30, 180, 160, 108, 0x000000, 0.5)
            .setOrigin(0)
            .setStrokeStyle(2, 0xffffff);
        // Text for selected character's stats
        let statText = this.add.text(40, 70, "", { fontSize: '16px', color: '#ffffff' });
        // Text for hovered character's stats
        let hoverStatText = this.add.text(40, 190, "", { fontSize: '16px', color: '#ffffff' });

        const updateStatsDisplay = (character) => {
            const { className, stats } = character;
            const resourceName = classes[className].statResource;
            statText.setText(
                `Class: ${className}\n` +
                `HP: ${stats.HP}\n` +
                `EXP: ${stats.EXP}\n` +
                `Damage: ${stats.Damage}\n` +
                `${resourceName}: ${stats[resourceName]}\n` +
                `Defending: ${stats.defending ? "Yes" : "No"}`
            );
        };

        const updateHoverStats = (character) => {
            const { className, stats } = character;
            const resourceName = classes[className].statResource;
            let textColor = '#ffffff'; // default
            if (this.selectedCharacter && this.selectedCharacter !== character) {
                let multiplier = damageMultipliers[this.selectedCharacter.className][character.className];
                if (multiplier > 1.0) {
                    textColor = '#90ee90'; // light green for advantage
                } else if (multiplier < 1.0) {
                    textColor = '#ffcccb'; // light red for disadvantage
                }
            }
            hoverStatText.setStyle({ color: textColor });
            hoverStatText.setText(
                `Class: ${className}\n` +
                `HP: ${stats.HP}\n` +
                `EXP: ${stats.EXP}\n` +
                `Damage: ${stats.Damage}\n` +
                `${resourceName}: ${stats[resourceName]}\n` +
                `Defending: ${stats.defending ? "Yes" : "No"}`
            );
        };

        // -------------------------
        // Groups for Overlays & Indicators
        // -------------------------
        this.movementIndicators = this.add.group();
        this.combatIndicators = this.add.group();
        this.aoePreviewGroup = this.add.group();
        this.combatTextGroup = this.add.group();
        this.attackAreaIndicators = this.add.group();

        const clearAttackArea = () => {
            this.attackAreaIndicators.clear(true, true);
        };

        // -------------------------
        // AoE Preview Functions
        // -------------------------
        const clearAOEPreview = () => {
            this.aoePreviewGroup.clear(true, true);
        };

        const showAOEPreview = (targetCol, targetRow) => {
            clearAOEPreview();
            const affectedCells = [
                { col: targetCol, row: targetRow },
                { col: targetCol + 1, row: targetRow },
                { col: targetCol - 1, row: targetRow },
                { col: targetCol, row: targetRow + 1 },
                { col: targetCol, row: targetRow - 1 }
            ];
            affectedCells.forEach(pos => {
                if (pos.col >= 0 && pos.col < gridCols && pos.row >= 0 && pos.row < gridRows) {
                    let preview = this.add.rectangle(
                        gridX + pos.col * gridSize + gridSize / 2,
                        gridY + pos.row * gridSize + gridSize / 2,
                        gridSize,
                        gridSize,
                        0xff4500,
                        0.5
                    );
                    this.aoePreviewGroup.add(preview);
                }
            });
        };

        // -------------------------
        // Show Attack Area Highlight on Button Hover
        // -------------------------
        const showAttackArea = (character, range, actionType) => {
            clearAttackArea();
            if (actionType === "defend") {
                let cell = this.gridCells.find(c => c.col === character.col && c.row === character.row);
                if (cell) {
                    let indicator = this.add.rectangle(
                        cell.cell.x,
                        cell.cell.y,
                        gridSize,
                        gridSize,
                        0xadd8e6,
                        0.5
                    );
                    this.attackAreaIndicators.add(indicator);
                }
            } else {
                let color;
                if (actionType === "fire") {
                    color = 0xffa500;
                } else if (actionType === "lightning" || actionType === "attack") {
                    color = 0x00ffff;
                }
                for (let r = -range; r <= range; r++) {
                    for (let c = -range; c <= range; c++) {
                        if (Math.abs(r) + Math.abs(c) <= range) {
                            let newCol = character.col + c;
                            let newRow = character.row + r;
                            if (newCol >= 0 && newCol < gridCols && newRow >= 0 && newRow < gridRows) {
                                let indicator = this.add.rectangle(
                                    gridX + newCol * gridSize + gridSize / 2,
                                    gridY + newRow * gridSize + gridSize / 2,
                                    gridSize,
                                    gridSize,
                                    color,
                                    0.3
                                );
                                this.attackAreaIndicators.add(indicator);
                            }
                        }
                    }
                }
            }
        };

        // -------------------------
        // Show Movement Range (Diamond Shape)
        // -------------------------
        const showMovementRange = (character) => {
            this.movementIndicators.clear(true, true);
            const { col, row, className, player } = character;
            const moveRange = classes[className].moveRange;
            for (let r = -moveRange; r <= moveRange; r++) {
                for (let c = -moveRange; c <= moveRange; c++) {
                    if (Math.abs(r) + Math.abs(c) <= moveRange) {
                        let newCol = col + c;
                        let newRow = row + r;
                        let key = `${newCol}-${newRow}`;
                        if (
                            newCol >= 0 && newCol < gridCols &&
                            newRow >= 0 && newRow < gridRows &&
                            !occupiedPositions.has(key)
                        ) {
                            let indicator = this.add.rectangle(
                                gridX + newCol * gridSize + gridSize / 2,
                                gridY + newRow * gridSize + gridSize / 2,
                                gridSize,
                                gridSize,
                                player === "player1" ? 0xffff88 : 0xbb88ff,
                                0.4
                            ).setInteractive();
                            indicator.on('pointerdown', () => {
                                if (!this.moveUsed) {
                                    moveCharacter(character, newCol, newRow);
                                    this.moveUsed = true;
                                    if (this.combatUsed) this.nextTurn();
                                }
                            });
                            this.movementIndicators.add(indicator);
                        }
                    }
                }
            }
        };

        // -------------------------
        // Move Character Function
        // -------------------------
        const moveCharacter = (character, newCol, newRow) => {
            let oldCol = character.col;
            let oldRow = character.row;
            let oldKey = `${oldCol}-${oldRow}`;
            let newKey = `${newCol}-${newRow}`;
            occupiedPositions.delete(oldKey);
            let oldCell = this.gridCells.find(c => c.col === oldCol && c.row === oldRow);
            if (oldCell) oldCell.cell.setStrokeStyle(2, 0xffffff);
            character.col = newCol;
            character.row = newRow;
            character.token.setPosition(
                gridX + newCol * gridSize + gridSize / 2,
                gridY + newRow * gridSize + gridSize / 2
            );
            if (character.halo) {
                character.halo.setPosition(character.token.x, character.token.y);
            }
            occupiedPositions.set(newKey, true);
            let newCell = this.gridCells.find(c => c.col === newCol && c.row === newRow);
            if (newCell) newCell.cell.setStrokeStyle(3, playerColors[character.player]);
            this.movementIndicators.clear(true, true);
        };

        // -------------------------
        // Create Tokens for Each Player (Randomized on Their Side)
        // -------------------------
        this.tokens = [];
        // Player 1 tokens: allowed columns 0–3; Player 2 tokens: allowed columns 6–9.
        const playerRanges = { player1: { min: 0, max: 3 }, player2: { min: 6, max: 9 } };
        Object.keys(playerRanges).forEach(player => {
            const { min, max } = playerRanges[player];
            const borderColor = playerColors[player];
            Object.keys(classes).forEach(className => {
                let pos = getRandomTokenPosition(min, max);
                let characterStats = {
                    HP: defaultStats.HP,
                    EXP: defaultStats.EXP,
                    Damage: defaultStats.Damage,
                    [classes[className].statResource]: 100,
                    defending: false
                };
                let token = this.add.circle(pos.x, pos.y, 20, classes[className].color).setInteractive();
                let character = { token, col: pos.col, row: pos.row, player, className, stats: characterStats, halo: null };
                this.tokens.push(character);
                occupiedPositions.set(`${pos.col}-${pos.row}`, true);
                let cell = this.gridCells.find(c => c.col === pos.col && c.row === pos.row);
                if (cell) cell.cell.setStrokeStyle(3, borderColor);
                token.on('pointerdown', () => {
                    if (this.currentTurn === player) {
                        this.selectedCharacter = character;
                        updateStatsDisplay(character);
                        if (!this.moveUsed) {
                            showMovementRange(character);
                        } else {
                            this.movementIndicators.clear(true, true);
                        }
                        if (!this.combatUsed) {
                            showCombatOptions(character);
                        } else {
                            clearCombatOptions();
                        }
                    }
                });
                token.on('pointerover', () => {
                    updateHoverStats(character);
                });
                token.on('pointerout', () => {
                    hoverStatText.setText("");
                });
            });
        });

        // -------------------------
        // Turn-Based System
        // -------------------------
        const rollD20 = () => Phaser.Math.Between(1, 20);
        const player1Roll = rollD20();
        const player2Roll = rollD20();
        this.p1RollText = this.add.text(gameWidth / 2 - 100, 20, `P1 Roll: ${player1Roll}`, { fontSize: '18px', color: '#ffff00' });
        this.p2RollText = this.add.text(gameWidth / 2 + 40, 20, `P2 Roll: ${player2Roll}`, { fontSize: '18px', color: '#aa00ff' });
        this.currentTurn = (player1Roll >= player2Roll) ? "player1" : "player2";
        this.turnText = this.add.text(gameWidth / 2, 50, `Current Turn: ${this.currentTurn}`, {
            fontSize: '24px',
            color: (this.currentTurn === 'player1') ? '#ffff00' : '#aa00ff',
            fontWeight: 'bold'
        }).setOrigin(0.5);

        this.nextTurn = () => {
            this.currentTurn = (this.currentTurn === "player1") ? "player2" : "player1";
            if (!this.initiativeRemoved) {
                this.initiativeRemoved = true;
                this.p1RollText.destroy();
                this.p2RollText.destroy();
            }
            this.moveUsed = false;
            this.combatUsed = false;
            this.selectedCharacter = null;
            this.movementIndicators.clear(true, true);
            this.combatIndicators.clear(true, true);
            this.aoePreviewGroup.clear(true, true);
            clearCombatOptions();
            clearAttackArea();
            const turnColor = (this.currentTurn === "player1") ? "#ffff00" : "#aa00ff";
            this.turnText.setText(`Current Turn: ${this.currentTurn}`);
            this.turnText.setStyle({ color: turnColor, fontSize: '24px', fontWeight: 'bold' });
            showTurnBanner(this.currentTurn);
        };

        const showTurnBanner = (playerId) => {
            let bannerBg = this.add.rectangle(gameWidth / 2, gameHeight / 2, 600, 120, 0x000000, 0.8).setOrigin(0.5);
            const color = (playerId === "player1") ? "#ffff00" : "#aa00ff";
            let bannerText = this.add.text(gameWidth / 2, gameHeight / 2, `Now it's ${playerId}'s turn!`, { fontSize: '36px', color: color, fontWeight: 'bold' }).setOrigin(0.5);
            this.time.delayedCall(2000, () => {
                bannerBg.destroy();
                bannerText.destroy();
            });
        };

        // -------------------------
        // Combat Options UI & Attack Area Highlight
        // -------------------------
        const clearCombatOptions = () => {
            this.combatTextGroup.clear(true, true);
            const actionsLabel = this.add.text(gameWidth - 170, 100, "Actions", { fontSize: '18px', color: '#ffffff' });
            this.combatTextGroup.add(actionsLabel);
        };

        const createActionButton = (label, callback, range, actionType) => {
            const baseX = gameWidth - 170;
            let yPos = 100 + this.combatTextGroup.getLength() * 40;
            let btn = this.add.text(baseX, yPos, label, {
                fontSize: '18px',
                backgroundColor: '#333333',
                color: '#ffffff',
                padding: { x: 10, y: 5 }
            }).setInteractive();
            btn.on('pointerdown', callback);
            btn.on('pointerover', () => {
                showAttackArea(this.selectedCharacter, range, actionType);
            });
            btn.on('pointerout', () => {
                clearAttackArea();
            });
            this.combatTextGroup.add(btn);
        };

        const showCombatOptions = (character) => {
            clearCombatOptions();
            const { className } = character;
            if (className === "Warrior") {
                createActionButton("Attack (Melee)", () => {
                    showCombatTargets(character, 1, "attack");
                }, 1, "attack");
                createActionButton("Defend", () => {
                    if (!this.combatUsed) {
                        character.stats.defending = true;
                        if (!character.halo) {
                            character.halo = this.add.circle(character.token.x, character.token.y, 30, 0xadd8e6, 0.5);
                        }
                        updateStatsDisplay(character);
                        this.combatUsed = true;
                        if (this.moveUsed) this.nextTurn();
                        clearCombatOptions();
                    }
                }, 0, "defend");
            } else if (className === "Archer") {
                createActionButton("Attack (Ranged)", () => {
                    showCombatTargets(character, 3, "attack");
                }, 3, "attack");
            } else if (className === "Mage") {
                createActionButton("Lightning", () => {
                    showCombatTargets(character, 3, "lightning");
                }, 3, "lightning");
                createActionButton("Fire (AoE)", () => {
                    showCombatTargets(character, 3, "fire");
                }, 3, "fire");
            }
        };

        const showCombatTargets = (character, range, actionType) => {
            this.combatIndicators.clear(true, true);
            clearAOEPreview();
            if (actionType === "fire") {
                for (let r = -range; r <= range; r++) {
                    for (let c = -range; c <= range; c++) {
                        if (Math.abs(r) + Math.abs(c) <= range) {
                            let targetCol = character.col + c;
                            let targetRow = character.row + r;
                            if (targetCol >= 0 && targetCol < gridCols && targetRow >= 0 && targetRow < gridRows) {
                                let indicator = this.add.rectangle(
                                    gridX + targetCol * gridSize + gridSize / 2,
                                    gridY + targetRow * gridSize + gridSize / 2,
                                    gridSize,
                                    gridSize,
                                    0xffa500,
                                    0.4
                                ).setInteractive();
                                indicator.on('pointerover', () => {
                                    showAOEPreview(targetCol, targetRow);
                                });
                                indicator.on('pointerout', () => {
                                    clearAOEPreview();
                                });
                                indicator.on('pointerdown', () => {
                                    applyFireAoE(character, targetCol, targetRow);
                                    this.combatUsed = true;
                                    if (this.moveUsed) this.nextTurn();
                                    this.combatIndicators.clear(true, true);
                                    clearAOEPreview();
                                    clearCombatOptions();
                                });
                                this.combatIndicators.add(indicator);
                            }
                        }
                    }
                }
            } else {
                this.tokens.forEach(target => {
                    if (target.player !== character.player) {
                        let dist = Math.abs(target.col - character.col) + Math.abs(target.row - character.row);
                        if (dist <= range) {
                            let highlight = this.add.circle(
                                target.token.x,
                                target.token.y,
                                30,
                                0xff0000,
                                0.3
                            ).setInteractive();
                            highlight.on('pointerdown', () => {
                                if (!this.combatUsed) {
                                    let baseDamage;
                                    if (character.className === "Warrior") {
                                        baseDamage = baseDamageValues.Warrior;
                                    } else if (character.className === "Archer") {
                                        baseDamage = baseDamageValues.Archer;
                                    } else if (character.className === "Mage" && actionType === "lightning") {
                                        baseDamage = baseDamageValues.MageLightning;
                                    }
                                    applyDamage(character, target, baseDamage);
                                    this.combatUsed = true;
                                    if (this.moveUsed) this.nextTurn();
                                    this.combatIndicators.clear(true, true);
                                    clearCombatOptions();
                                }
                            });
                            this.combatIndicators.add(highlight);
                        }
                    }
                });
            }
        };

        const applyDamage = (attacker, defender, baseDamage) => {
            if (defender.stats.defending) {
                baseDamage = Math.floor(baseDamage / 2);
                defender.stats.defending = false;
                if (defender.halo) {
                    defender.halo.destroy();
                    defender.halo = null;
                }
            }
            let multiplier = damageMultipliers[attacker.className][defender.className];
            let effectiveDamage = Math.floor(baseDamage * multiplier);
            defender.stats.HP -= effectiveDamage;
            if (this.selectedCharacter === defender) {
                updateStatsDisplay(defender);
            }
            if (defender.stats.HP <= 0) {
                removeCharacter(defender);
            }
        };

        const applyFireAoE = (attacker, centerCol, centerRow) => {
            let affectedCoords = [
                { col: centerCol, row: centerRow },
                { col: centerCol + 1, row: centerRow },
                { col: centerCol - 1, row: centerRow },
                { col: centerCol, row: centerRow + 1 },
                { col: centerCol, row: centerRow - 1 }
            ];
            let victims = [];
            affectedCoords.forEach(pos => {
                let victim = this.tokens.find(t => t.col === pos.col && t.row === pos.row && t.player !== attacker.player);
                if (victim) victims.push(victim);
            });
            if (victims.length > 0) {
                let splitDamage = Math.floor(baseDamageValues.MageFire / victims.length);
                victims.forEach(victim => {
                    applyDamage(attacker, victim, splitDamage);
                });
            }
        };

        const removeCharacter = (character) => {
            let key = `${character.col}-${character.row}`;
            occupiedPositions.delete(key);
            let cell = this.gridCells.find(c => c.col === character.col && c.row === character.row);
            if (cell) cell.cell.setStrokeStyle(2, 0xffffff);
            character.token.destroy();
            if (character.halo) {
                character.halo.destroy();
            }
            this.tokens = this.tokens.filter(t => t !== character);
            if (this.selectedCharacter === character) {
                statText.setText("");
                this.selectedCharacter = null;
            }
            checkWinCondition();
        };

        const checkWinCondition = () => {
            const player1Tokens = this.tokens.filter(t => t.player === "player1");
            const player2Tokens = this.tokens.filter(t => t.player === "player2");
            if (player1Tokens.length === 0 || player2Tokens.length === 0) {
                let winner = player1Tokens.length > 0 ? "Player 1" : "Player 2";
                gameOver(winner);
            }
        };

        const gameOver = (winner) => {
            this.tokens.forEach(character => {
                character.token.disableInteractive();
            });
            this.movementIndicators.clear(true, true);
            this.combatIndicators.clear(true, true);
            this.aoePreviewGroup.clear(true, true);
            clearCombatOptions();
            clearAttackArea();
            let overlay = this.add.rectangle(gameWidth / 2, gameHeight / 2, gameWidth, gameHeight, 0x000000, 0.7);
            let banner = this.add.text(gameWidth / 2, gameHeight / 2 - 50, `Congratulations!\n${winner} Wins!`, { fontSize: '48px', color: '#ffffff', align: 'center' }).setOrigin(0.5);
            let newGameButton = this.add.text(gameWidth / 2, gameHeight / 2 + 50, "New Game", { fontSize: '32px', backgroundColor: '#4444ff', color: '#ffffff', padding: { x: 20, y: 10 } }).setOrigin(0.5).setInteractive();
            newGameButton.on('pointerdown', () => {
                this.scene.restart();
            });
        };

        // -------------------------
        // Right Panel: End Turn & Back Buttons
        // -------------------------
        this.add.rectangle(
            gameWidth - 120,
            gameHeight / 2,
            200,
            gameHeight - 50,
            0x222222,

        ).setOrigin(0.5);
        this.add.text(gameWidth - 170, 100, "Actions", { fontSize: '18px', color: '#ffffff' });
        const endTurnButton = this.add.text(gameWidth - 100, gameHeight - 50, 'End Turn', { fontSize: '20px', backgroundColor: '#4444ff', color: '#ffffff', padding: { x: 10, y: 5 } }).setOrigin(0.5).setInteractive();
        endTurnButton.on('pointerdown', () => {
            this.nextTurn();
        });
        const backButton = this.add.text(gameWidth / 2, gameHeight - 50, 'Back to Title', { fontSize: '20px', backgroundColor: '#ff4444', color: '#ffffff', padding: { x: 10, y: 5 } }).setOrigin(0.5).setInteractive();
        backButton.on('pointerdown', () => {
            this.scene.start('TitleScene');
        });

        // -------------------------
        // End of create()
        // -------------------------
    }
}

// Phaser game configuration
const config = {
    type: Phaser.AUTO,
    width: 1914,
    height: 1080,
    scene: [TitleScene, GameScene], // Add more scenes here later
    parent: 'game',
};

// Initialize the game
const game = new Phaser.Game(config);
