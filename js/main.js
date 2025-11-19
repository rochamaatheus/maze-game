import * as THREE from 'three';
import { CONFIG } from './config.js';
import { InputManager } from './input.js';
import { ParticleEmitter } from './particleEmitter.js';
import { MazeManager } from './maze.js';
import { Player } from './player.js';
import { ItemManager } from './items.js';
import { UIManager } from './ui.js';
import { AudioManager } from './audio.js'; 
import { Enemy } from './enemy.js';

class Game {
    constructor() {
        this.isGameActive = false;
        this.isGameRunning = false; 
        this.prevTime = performance.now();
        this.mouseSensitivity = 0.002;
        
        this.ignoreMouseInput = false; 

        // 1. Setup Three.js
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(CONFIG.COLORS.BG);
        this.scene.fog = new THREE.FogExp2(CONFIG.COLORS.FOG, 0.12);

        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth/window.innerHeight, 0.1, 150);
        
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        document.body.appendChild(this.renderer.domElement);

        // Luzes
        this.scene.add(new THREE.AmbientLight(0x111111));
        const torch = new THREE.SpotLight(0xffddaa, 40, 50, Math.PI/4, 0.4, 1);
        torch.position.set(0,0,0);
        torch.target.position.set(0,0,-1);
        this.camera.add(torch);
        this.camera.add(torch.target);
        this.scene.add(this.camera);

        // 2. Setup Modules
        this.input = new InputManager();
        
        this.audio = new AudioManager(this.camera); 
        this.audio.load(); 

        this.maze = new MazeManager(this.scene);
        this.items = new ItemManager(this.scene);
        this.ui = new UIManager();
        
        this.player = new Player(this.camera, this.scene, this.audio);
        this.particles = new ParticleEmitter(this.scene, this.maze);
        this.enemy = new Enemy(this.scene, this.player, this.maze);

        // 3. Bind UI Events
        this._bindEvents();

        // 4. Start Loop
        this.animate();
    }

    _bindEvents() {
        window.addEventListener('resize', () => {
            this.camera.aspect = window.innerWidth/window.innerHeight;
            this.camera.updateProjectionMatrix();
            this.renderer.setSize(window.innerWidth, window.innerHeight);
        });

        document.addEventListener('mousemove', (e) => {
            if(!this.isGameActive || this.ignoreMouseInput) return;
            this.player.look(e.movementX, e.movementY, this.mouseSensitivity);
        });

        document.getElementById('btn-restart').addEventListener('click', () => {
            const size = parseInt(document.getElementById('maze-size-input').value);
            this.startNewGame(size % 2 === 0 ? size + 1 : size);
        });

        document.getElementById('btn-resume').addEventListener('click', () => {
            document.body.requestPointerLock();
        });

        document.addEventListener('pointerlockchange', () => {
            this.isGameActive = (document.pointerLockElement === document.body);
            
            const overlay = document.getElementById('menu-overlay');
            const btnResume = document.getElementById('btn-resume');
            
            if(this.isGameActive) {
                overlay.classList.add('hidden');
                this.ignoreMouseInput = true;
                setTimeout(() => { this.ignoreMouseInput = false; }, 100);
            } else {
                overlay.classList.remove('hidden');
                if(this.isGameRunning) {
                    btnResume.classList.remove('hidden');
                } else {
                    btnResume.classList.add('hidden');
                }
            }
        });

        document.getElementById('sensitivity').addEventListener('input', (e) => {
            const val = parseFloat(e.target.value);
            if (val <= 0 || isNaN(val)) {
                this.mouseSensitivity = 0.002; 
            } else {
                this.mouseSensitivity = val;
            }
        });

        this.input.on('interact', () => this._tryPickup());
        this.input.on('use1', () => this._useItem(0));
        this.input.on('use2', () => this._useItem(1));
        this.input.on('use3', () => this._useItem(2));
    }

    startNewGame(size) {
        if(size < 9) size = 9;
        
        this.maze.generate(size);
        this.items.spawnItems(this.maze.data, 5);
        this.player.spawn(1, 1);
        this.ui.reset(size);
        
        this.enemy.despawn();

        // CORREÇÃO: Reseta os controles para o player não andar sozinho
        this.input.reset(); 

        this.isGameRunning = true;
        document.body.requestPointerLock();
    }

    _tryPickup() {
        if(!this.isGameActive) return;
        const pos = this.player.getPosition();
        const item = this.items.checkPickup(pos.x, pos.z);
        
        if(item) {
            const emptySlot = this.player.inventory.indexOf(null);
            if(emptySlot !== -1) {
                this.player.inventory[emptySlot] = "ORBE";
                this.items.removeItem(item.id);
                this.ui.updateInventory(this.player.inventory);
            } else {
                this.ui.showMessage("Inventário Cheio!");
            }
        }
    }

    _useItem(slot) {
        if(this.player.inventory[slot]) {
            this.player.restoreStamina(100); 
            this.player.inventory[slot] = null;
            this.ui.updateInventory(this.player.inventory);
            this.ui.showMessage("Energia Máxima!");
        }
    }

    _handleHammerLogic() {
        if (this.input.isHammerPressed) {
            const wallHit = this.player.tryAttack(this.maze.walls);

            if (wallHit) {
                if(this.audio) {
                    this.audio.play('break', 0.8);  
                    this.audio.play('impact', 1.0); 
                }
                
                const direction = new THREE.Vector3();
                this.camera.getWorldDirection(direction);

                this.particles.emitWallBreak(
                    wallHit.position.clone(), 
                    wallHit.material.color.getHex(),
                    direction 
                );

                this.maze.removeWall(wallHit); 
            }
            this.input.isHammerPressed = false;
        }
    }

    animate() {
        requestAnimationFrame(() => this.animate());
        
        const time = performance.now();
        const delta = Math.min((time - this.prevTime) / 1000, 0.1);
        this.prevTime = time;

        if(this.isGameActive) {
            this.player.handleInput(delta, this.input.getMovementState(), this.maze);
            this._handleHammerLogic();
            
            this.items.animate(delta);
            this.particles.animate(delta);

            const enemyStatus = this.enemy.update(delta);

            if (enemyStatus === "GAME_OVER") {
                alert("VOCÊ FOI PEGO! O Labirinto te consumiu.");
                document.exitPointerLock();
                this.startNewGame(this.maze.size);
                return; 
            }
            
            this.ui.updateStamina(this.player.stamina, CONFIG.STAMINA.MAX, this.player.canSprint);
            this.ui.updateHammer(
                this.player.hammerState.cooldownTimer, 
                this.player.hammerState.ready
            );
            this.ui.updateMinimap(this.maze.data, this.player.getPosition(), this.items.items.filter(i=>i.active));
            
            const pos = this.player.getPosition();
            const itemNear = this.items.checkPickup(pos.x, pos.z);
            this.ui.toggleMessage(!!itemNear && this.player.inventory.includes(null), "[E] Pegar Orbe");

            const px = Math.floor(pos.x / CONFIG.CELL_SIZE);
            const pz = Math.floor(pos.z / CONFIG.CELL_SIZE);
            if(this.maze.data[px] && this.maze.data[px][pz] === 2) {
                alert("Vitória! Você escapou.");
                document.exitPointerLock();
                this.isGameRunning = false;
                document.getElementById('btn-resume').classList.add('hidden');
            }
        }

        this.renderer.render(this.scene, this.camera);
    }
}

new Game();