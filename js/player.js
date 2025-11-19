import * as THREE from 'three';
import { CONFIG } from './config.js';

export class Player {
    constructor(camera, scene, audioManager) {
        this.camera = camera;
        
        // Define ordem de rotação no início (Evita flickering)
        this.camera.rotation.order = "YXZ"; 
        
        this.scene = scene;
        this.audio = audioManager; // Referência do áudio
        
        this.velocity = new THREE.Vector3();
        
        // --- SISTEMA DE SUAVIZAÇÃO DE CÂMERA ---
        this.pitch = 0;          // Rotação atual X (Cabeça)
        this.yaw = 0;            // Rotação atual Y (Corpo)
        this.targetPitch = 0;    // Alvo X
        this.targetYaw = 0;      // Alvo Y
        this.smoothFactor = 20.0;
        // ---------------------------------------

        this.raycaster = new THREE.Raycaster();
        this.stamina = CONFIG.STAMINA.MAX;
        this.canSprint = true;
        this.inventory = [null, null, null];

        // Hammer System
        this.hammerMesh = null;
        this.hammerState = {
            ready: true,
            cooldownTimer: 0,
            isSwinging: false,
            swingProgress: 0
        };
        this._buildHammer();
    }

    _buildHammer() {
        this.hammerMesh = new THREE.Group();

        const handleGeo = new THREE.CylinderGeometry(0.04, 0.04, 0.8, 8);
        const handleMat = new THREE.MeshStandardMaterial({ color: CONFIG.COLORS.HAMMER_HANDLE });
        const handle = new THREE.Mesh(handleGeo, handleMat);
        handle.position.y = 0.4;

        const headGeo = new THREE.BoxGeometry(0.2, 0.15, 0.4);
        const headMat = new THREE.MeshStandardMaterial({ color: CONFIG.COLORS.HAMMER_HEAD, metalness: 0.6, roughness: 0.4 });
        const head = new THREE.Mesh(headGeo, headMat);
        head.position.y = 0.8;

        this.hammerMesh.add(handle);
        this.hammerMesh.add(head);
        this.hammerMesh.position.set(0.5, -0.5, -0.8);
        this.hammerMesh.rotation.set(0.2, -0.2, 0.2);
        this.camera.add(this.hammerMesh);
    }

    spawn(xGrid, zGrid) {
        const wx = xGrid * CONFIG.CELL_SIZE + CONFIG.CELL_SIZE/2;
        const wz = zGrid * CONFIG.CELL_SIZE + CONFIG.CELL_SIZE/2;
        
        // Reseta câmera e alvos de suavização
        this.camera.position.set(wx, CONFIG.PLAYER_HEIGHT, wz);
        this.targetPitch = 0;
        this.targetYaw = 0;
        this.pitch = 0;
        this.yaw = 0;
        this.camera.rotation.set(0,0,0);
        
        this.velocity.set(0,0,0);
        this.stamina = CONFIG.STAMINA.MAX;
        
        this.hammerState.ready = true;
        this.hammerState.cooldownTimer = 0;
        this.camera.fov = CONFIG.PHYSICS.FOV_WALK;
        this.camera.updateProjectionMatrix();
    }

    tryAttack(walls) {
        if(!this.hammerState.ready || this.hammerState.isSwinging) return null;

        this.raycaster.setFromCamera(new THREE.Vector2(0, 0), this.camera);
        const intersects = this.raycaster.intersectObjects(walls);

        if (intersects.length > 0 && intersects[0].distance <= CONFIG.HAMMER.REACH) {
            this.hammerState.isSwinging = true;
            this.hammerState.swingProgress = 0;
            this.hammerState.ready = false;
            this.hammerState.cooldownTimer = CONFIG.HAMMER.COOLDOWN;
            return intersects[0].object; 
        }
        return null; 
    }

    look(movementX, movementY, sensitivity) {
        // Atualiza apenas os ALVOS, a suavização ocorre no handleInput
        this.targetYaw -= movementX * sensitivity;
        this.targetPitch -= movementY * sensitivity;
        this.targetPitch = Math.max(-1.4, Math.min(1.4, this.targetPitch));
    }

    handleInput(delta, inputState, mazeManager) {
        // 1. Suavização da Câmera (Interpolation)
        this.yaw += (this.targetYaw - this.yaw) * this.smoothFactor * delta;
        this.pitch += (this.targetPitch - this.pitch) * this.smoothFactor * delta;
        this.camera.rotation.y = this.yaw;
        this.camera.rotation.x = this.pitch;

        // 2. Estados de Input
        const { forward, backward, left, right, sprint } = inputState;
        const isInputMoving = forward || backward || left || right;
        let isRunning = false;
        let speedMult = 1.0;

        // 3. Stamina e Corrida
        if(isInputMoving && sprint && this.canSprint) {
            isRunning = true;
            speedMult = CONFIG.PHYSICS.SPRINT_MULTIPLIER;
            this.stamina -= CONFIG.STAMINA.DRAIN_RATE * delta;
            if(this.stamina <= 0) { this.stamina = 0; this.canSprint = false; }
        } else {
            const regen = isInputMoving ? CONFIG.STAMINA.REGEN_WALK : CONFIG.STAMINA.REGEN_IDLE;
            this.stamina += regen * delta;
            if(this.stamina > CONFIG.STAMINA.MAX) this.stamina = CONFIG.STAMINA.MAX;
            if(!this.canSprint && this.stamina > 20) this.canSprint = true;
        }

        // 4. Física (Fricção e Aceleração)
        const friction = CONFIG.PHYSICS.FRICTION;
        const acceleration = CONFIG.PHYSICS.ACCELERATION;
        const maxSpeed = CONFIG.PHYSICS.BASE_SPEED * speedMult;

        this.velocity.x -= this.velocity.x * friction * delta;
        this.velocity.z -= this.velocity.z * friction * delta;

        const fwd = new THREE.Vector3(0, 0, -1).applyAxisAngle(new THREE.Vector3(0, 1, 0), this.yaw);
        const rgt = new THREE.Vector3(1, 0, 0).applyAxisAngle(new THREE.Vector3(0, 1, 0), this.yaw);
        
        let dir = new THREE.Vector3();
        if(forward) dir.add(fwd);
        if(backward) dir.sub(fwd);
        if(right) dir.add(rgt);
        if(left) dir.sub(rgt);

        if(dir.lengthSq() > 0) {
            dir.normalize();
            this.velocity.x += dir.x * acceleration * delta;
            this.velocity.z += dir.z * acceleration * delta;
        }
        
        // Limite de velocidade
        const currSpeedCalc = Math.sqrt(this.velocity.x**2 + this.velocity.z**2);
        if(currSpeedCalc > maxSpeed) {
            this.velocity.x = (this.velocity.x / currSpeedCalc) * maxSpeed;
            this.velocity.z = (this.velocity.z / currSpeedCalc) * maxSpeed;
        }

        // 5. Movimento e Colisão
        let dx = this.velocity.x * delta;
        let dz = this.velocity.z * delta;

        // Se colidir em X, zera velocidade X
        if(!mazeManager.checkCollision(this.camera.position.x + dx, this.camera.position.z, CONFIG.PLAYER_RADIUS)) {
            this.camera.position.x += dx;
        } else { this.velocity.x = 0; }

        // Se colidir em Z, zera velocidade Z
        if(!mazeManager.checkCollision(this.camera.position.x, this.camera.position.z + dz, CONFIG.PLAYER_RADIUS)) {
            this.camera.position.z += dz;
        } else { this.velocity.z = 0; }

        // 6. Efeito FOV
        const targetFOV = isRunning ? CONFIG.PHYSICS.FOV_RUN : CONFIG.PHYSICS.FOV_WALK;
        this.camera.fov += (targetFOV - this.camera.fov) * (5.0 * delta);
        this.camera.updateProjectionMatrix();

        // 7. SOM DE PASSOS (CORRIGIDO)
        // Verificamos a velocidade REAL atual (após colisões terem zerado se necessário)
        if(this.audio) {
            const realSpeed = Math.sqrt(this.velocity.x**2 + this.velocity.z**2);
            
            // MUDANÇA AQUI: Aumentei de 0.1 para 1.5
            // Se a velocidade for menor que 1.5 (desacelerando), considera parado para o som.
            const actuallyMoving = realSpeed > 1.5; 
            
            this.audio.updateSteps(actuallyMoving, isRunning, delta);
        }

        // 8. Atualiza Marreta
        this._updateHammer(delta);
    }

    _updateHammer(delta) {
        if(this.hammerState.isSwinging) {
            this.hammerState.swingProgress += delta * 5.0; 
            if(this.hammerState.swingProgress >= Math.PI) {
                this.hammerState.isSwinging = false;
                this.hammerMesh.rotation.set(0.2, -0.2, 0.2);
            } else {
                const swingAngle = Math.sin(this.hammerState.swingProgress);
                this.hammerMesh.rotation.x = 0.2 - (swingAngle * 1.5);
            }
        } else {
            if(this.hammerState.ready) {
                const time = performance.now() / 1000;
                this.hammerMesh.position.y = -0.5 + Math.sin(time * 2) * 0.01;
                this.hammerMesh.rotation.z = 0.2 + Math.sin(time) * 0.02;
            } else {
                this.hammerMesh.position.y = -0.7; 
                this.hammerMesh.rotation.x = 0.5;
            }
        }

        if(this.hammerState.cooldownTimer > 0) {
            this.hammerState.cooldownTimer -= delta;
            if(this.hammerState.cooldownTimer <= 0) {
                this.hammerState.cooldownTimer = 0;
                this.hammerState.ready = true;
                this.hammerMesh.position.y = -0.5;
                this.hammerMesh.rotation.set(0.2, -0.2, 0.2);
            }
        }
    }
    
    restoreStamina(amount) {
        this.stamina = Math.min(this.stamina + amount, CONFIG.STAMINA.MAX);
    }

    getPosition() { return this.camera.position; }
}