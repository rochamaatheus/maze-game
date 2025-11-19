import { CONFIG } from './config.js';

export class UIManager {
    constructor() {
        this.canvasMini = document.getElementById('minimap-canvas');
        this.ctxMini = this.canvasMini.getContext('2d');
        this.staminaBar = document.getElementById('stamina-bar');
        this.msgBox = document.getElementById('interaction-msg');
        this.slots = [
            document.getElementById('slot-1'),
            document.getElementById('slot-2'),
            document.getElementById('slot-3')
        ];
        
        // Elementos Marreta
        this.hammerUI = document.getElementById('hammer-ui');
        this.hammerTimer = document.getElementById('hammer-timer');
        
        this.visitedCells = [];
    }

    reset(mazeSize) {
        const pxSize = mazeSize * 6;
        this.canvasMini.width = pxSize;
        this.canvasMini.height = pxSize;
        
        this.visitedCells = [];
        for(let x=0; x<mazeSize; x++) {
            this.visitedCells[x] = [];
            for(let z=0; z<mazeSize; z++) this.visitedCells[x][z] = false;
        }
        this.updateInventory([null,null,null]);
        this.updateHammer(0, true);
    }

    updateHammer(timer, isReady) {
        // Garante que pegamos o elemento (caso não tenha salvo no constructor)
        if(!this.hammerUI) this.hammerUI = document.getElementById('hammer-ui');

        if(isReady) {
            // 1. Estado PRONTO
            this.hammerUI.className = 'ready';
            this.hammerUI.innerText = "🔨"; // Apenas o ícone no quadrado amarelo
        } else {
            // 2. Estado RECARREGANDO
            this.hammerUI.className = 'cooldown';
            // Mostra apenas o número (ex: 4.5) arredondado
            this.hammerUI.innerText = timer.toFixed(1); 
        }
    }

    updateStamina(current, max, canSprint) {
        const pct = (current / max) * 100;
        this.staminaBar.style.width = `${pct}%`;
        this.staminaBar.style.backgroundColor = canSprint ? "#00aaff" : "#cc0000";
    }

    showMessage(text, duration=1000) {
        this.msgBox.innerText = text;
        this.msgBox.style.display = "block";
        setTimeout(() => this.msgBox.style.display = "none", duration);
    }

    toggleMessage(visible, text="") {
        if(visible) {
            this.msgBox.innerText = text;
            this.msgBox.style.display = "block";
        } else {
            this.msgBox.style.display = "none";
        }
    }

    updateInventory(inv) {
        for(let i=0; i<3; i++) {
            if(inv[i]) {
                this.slots[i].innerHTML = `<span class="inv-key">${i+1}</span>🔵`;
                this.slots[i].classList.add('has-item');
            } else {
                this.slots[i].innerHTML = `<span class="inv-key">${i+1}</span>`;
                this.slots[i].classList.remove('has-item');
            }
        }
    }

    updateMinimap(mazeData, playerPos, activeItems) {
        const size = mazeData.length;
        const tileW = this.canvasMini.width / size;
        const tileH = this.canvasMini.height / size;
        
        const px = Math.floor(playerPos.x / CONFIG.CELL_SIZE);
        const pz = Math.floor(playerPos.z / CONFIG.CELL_SIZE);

        // Fog Reveal
        for(let i=-1; i<=1; i++) {
            for(let j=-1; j<=1; j++) {
                if(px+i >=0 && px+i < size && pz+j >=0 && pz+j < size) {
                    this.visitedCells[px+i][pz+j] = true;
                }
            }
        }

        // Draw
        this.ctxMini.fillStyle = "#000";
        this.ctxMini.fillRect(0,0, this.canvasMini.width, this.canvasMini.height);

        for(let x=0; x<size; x++) {
            for(let z=0; z<size; z++) {
                if(this.visitedCells[x][z]) {
                    if(mazeData[x][z] === 1) this.ctxMini.fillStyle = "#555";
                    else if(mazeData[x][z] === 2) this.ctxMini.fillStyle = "#0f0";
                    else this.ctxMini.fillStyle = "#224";
                    this.ctxMini.fillRect(x*tileW, z*tileH, tileW+0.6, tileH+0.6);
                }
            }
        }

        // Draw active items on map
        this.ctxMini.fillStyle = "#00aaff";
        activeItems.forEach(item => {
            let ix = Math.floor(item.x / CONFIG.CELL_SIZE);
            let iz = Math.floor(item.z / CONFIG.CELL_SIZE);
            if(this.visitedCells[ix][iz]) {
                 this.ctxMini.beginPath(); 
                 this.ctxMini.arc(ix*tileW + tileW/2, iz*tileH + tileH/2, tileW/3, 0, Math.PI*2); 
                 this.ctxMini.fill();
            }
        });

        // Player Dot
        const mx = (playerPos.x / (size*CONFIG.CELL_SIZE)) * this.canvasMini.width;
        const mz = (playerPos.z / (size*CONFIG.CELL_SIZE)) * this.canvasMini.height;
        this.ctxMini.fillStyle = "#f00";
        this.ctxMini.beginPath(); this.ctxMini.arc(mx, mz, tileW/2, 0, Math.PI*2); this.ctxMini.fill();
    }
}