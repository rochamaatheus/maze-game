import * as THREE from 'three';
import { CONFIG } from './config.js';

export class Enemy {
    constructor(scene, player, mazeManager, audioManager) {
        this.scene = scene;
        this.player = player;
        this.mazeManager = mazeManager;
        this.audioManager = audioManager;
        
        this.isActive = false;
        this.mesh = null;
        this.visionCone = null;
        
        this.state = 'SEARCHING'; // SEARCHING, CHASING, INVESTIGATING
        this.lastKnownPosition = new THREE.Vector3();
        this.position = new THREE.Vector3(0, -100, 0); 
        this.velocity = new THREE.Vector3();
        
        this.lifeTimer = 0;      
        this.speedOscillator = 0;

        // Audio
        this.chaseSound = null;
        this.footstepSound = null;
        this.stepTimer = 0;

        // Raycaster exclusivo para ajustar o tamanho visual do cone
        this.visionRaycaster = new THREE.Raycaster();

        this._buildMesh();
        this._setupAudio();
    }

    _setupAudio() {
        if(!this.audioManager) return;
        
        // Cria o som posicional
        this.chaseSound = new THREE.PositionalAudio(this.audioManager.listener);
        this.chaseSound.setRefDistance(2);
        this.chaseSound.setRolloffFactor(1);
        this.chaseSound.setDistanceModel('exponential');
        this.chaseSound.setVolume(1.5);
        this.chaseSound.setLoop(true);
        
        this.mesh.add(this.chaseSound);

        // Cria som de passos
        this.footstepSound = new THREE.PositionalAudio(this.audioManager.listener);
        this.footstepSound.setRefDistance(2);
        this.footstepSound.setRolloffFactor(1);
        this.footstepSound.setDistanceModel('exponential');
        this.footstepSound.setVolume(1.0); // Passos pesados
        this.mesh.add(this.footstepSound);
    }

    _buildMesh() {
        // Corpo
        const geo = new THREE.CapsuleGeometry(0.6, 1.8, 4, 8);
        const mat = new THREE.MeshStandardMaterial({ 
            color: CONFIG.COLORS.ENEMY, 
            emissive: 0x220000, // Emissive mais fraco pra ficar "dark"
            roughness: 0.2
        });
        this.mesh = new THREE.Mesh(geo, mat);
        
        // Olhos
        const eyeGeo = new THREE.BoxGeometry(0.8, 0.2, 0.4);
        const eyeMat = new THREE.MeshBasicMaterial({ color: 0xffff00 });
        const eyes = new THREE.Mesh(eyeGeo, eyeMat);
        eyes.position.set(0, 0.5, 0.4);
        this.mesh.add(eyes);

        // --- CONE DE VISÃO OTIMIZADO ---
        // 1. Usamos altura = 1 para facilitar a escala (scale.y = distância)
        // 2. "OpenEnded" (true) para parecer um feixe de luz
        const coneGeo = new THREE.ConeGeometry(4, 1, 32, 1, true);
        
        // Move geometria para base ficar no 0 e ponta no +1 Y
        coneGeo.translate(0, 0.5, 0); 
        coneGeo.rotateX(-Math.PI / 2); // Deita o cone para apontar para Z+

        const coneMat = new THREE.MeshBasicMaterial({
            color: CONFIG.COLORS.ENEMY_VISION,
            transparent: true,
            opacity: 0.08, 
            side: THREE.DoubleSide,
            depthWrite: false, 
            blending: THREE.AdditiveBlending,
            visible: false // ESCONDIDO
        });
        
        this.visionCone = new THREE.Mesh(coneGeo, coneMat);
        // Posiciona na altura dos olhos
        this.visionCone.position.set(0, 0.5, 0);
        
        this.mesh.add(this.visionCone);

        this.scene.add(this.mesh);
        this.mesh.visible = false;
    }

    spawnAroundPlayer() {
        const pPos = this.player.getPosition();
        let validSpawn = false;
        let attempts = 0;

        while(!validSpawn && attempts < 20) {
            attempts++;
            
            const angle = Math.random() * Math.PI * 2;
            // Distância atualizada pelo Config
            const dist = CONFIG.ENEMY.spawnRadiusMin + Math.random() * (CONFIG.ENEMY.spawnRadiusMax - CONFIG.ENEMY.spawnRadiusMin);
            
            const tx = pPos.x + Math.cos(angle) * dist;
            const tz = pPos.z + Math.sin(angle) * dist;

            if (!this.mazeManager.checkCollision(tx, tz, 1.0)) {
                this.position.set(tx, CONFIG.PLAYER_HEIGHT, tz);
                this.mesh.position.copy(this.position);
                this.mesh.visible = true;
                this.isActive = true;
                this.state = 'SEARCHING';
                this.lifeTimer = CONFIG.ENEMY.lifeTime;
                
                // Tenta carregar o buffer se ainda não tiver (pode ter carregado depois do start)
                if(this.chaseSound && !this.chaseSound.buffer) {
                    const buff = this.audioManager.getBuffer('ambient'); // Placeholder
                    if(buff) this.chaseSound.setBuffer(buff);
                }
                if(this.footstepSound && !this.footstepSound.buffer) {
                    const buff = this.audioManager.getBuffer('step');
                    if(buff) this.footstepSound.setBuffer(buff);
                }
                console.log("Inimigo Spawnado (Longe e Seguro)!");
                validSpawn = true;
            }
        }
    }

    despawn() {
        this.isActive = false;
        this.mesh.visible = false;
        this.position.set(0, -100, 0); 
        this.mesh.position.copy(this.position);
        if(this.chaseSound && this.chaseSound.isPlaying) this.chaseSound.stop();
        if(this.footstepSound && this.footstepSound.isPlaying) this.footstepSound.stop();
    }

    update(delta) {
        if (!this.isActive) {
            // 0.5% de chance por frame de spawnar
            if (Math.random() < 0.005) this.spawnAroundPlayer();
            return null;
        }

        if (this.state === 'SEARCHING') {
            this.lifeTimer -= delta;
            if (this.lifeTimer <= 0) {
                this.despawn();
                return null;
            }
            if(this.chaseSound && this.chaseSound.isPlaying) this.chaseSound.stop();
        } else {
            this.lifeTimer = CONFIG.ENEMY.lifeTime;
            // Toca som se estiver perseguindo ou investigando
            if(this.chaseSound && !this.chaseSound.isPlaying && this.chaseSound.buffer) {
                this.chaseSound.play();
            }
        }

        this._checkVision();
        
        // Atualiza VISUAL do cone (3 Raios)
        this._updateConeVisuals();

        this._move(delta);
        this._updateSteps(delta);

        this.mesh.position.copy(this.position);
        const targetRot = Math.atan2(this.velocity.x, this.velocity.z);
        this.mesh.rotation.y = targetRot;

        const distToPlayer = this.position.distanceTo(this.player.getPosition());
        if (distToPlayer < 1.5) {
            return "GAME_OVER"; 
        }
        return null;
    }

    // Ajusta o tamanho do cone visual com colisão precisa (3 raios)
    _updateConeVisuals() {
        const eyePos = this.position.clone().add(new THREE.Vector3(0, 0.5, 0));
        const baseDir = new THREE.Vector3(0, 0, 1).applyAxisAngle(new THREE.Vector3(0, 1, 0), this.mesh.rotation.y);
        
        const halfFov = CONFIG.ENEMY.fov / 2;

        // Testa 3 direções: Centro, Esquerda limite, Direita limite
        const angles = [0, -halfFov, halfFov];
        
        let shortestDist = CONFIG.ENEMY.viewDistance; // Começa com alcance máximo

        for(let angle of angles) {
            const dir = baseDir.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), angle);
            
            this.visionRaycaster.set(eyePos, dir);
            const intersects = this.visionRaycaster.intersectObjects(this.mazeManager.meshes);

            if (intersects.length > 0) {
                if (intersects[0].distance < shortestDist) {
                    shortestDist = intersects[0].distance;
                }
            }
        }

        // Aplica um pequeno recuo para evitar Z-fighting visual
        const visualDist = Math.max(0.1, shortestDist - 0.2);

        this.visionCone.scale.z = visualDist;
        const scaleRatio = visualDist / CONFIG.ENEMY.viewDistance;
        this.visionCone.scale.x = scaleRatio;
        this.visionCone.scale.y = scaleRatio;
    }

    _checkVision() {
        const pPos = this.player.getPosition();
        const toPlayer = new THREE.Vector3().subVectors(pPos, this.position);
        const dist = toPlayer.length();

        if (dist > CONFIG.ENEMY.viewDistance) {
            if(this.state === 'CHASING') {
                this.state = 'INVESTIGATING';
                this.lastKnownPosition.copy(pPos);
            }
            // Se já estava INVESTIGATING, mantém. Se estava SEARCHING, mantém.
            return;
        }

        toPlayer.normalize(); 
        const enemyDir = new THREE.Vector3(0, 0, 1).applyAxisAngle(new THREE.Vector3(0, 1, 0), this.mesh.rotation.y);
        const angle = enemyDir.dot(toPlayer); 
        
        if (angle > 0.5) {
            const raycaster = new THREE.Raycaster(
                this.position.clone().add(new THREE.Vector3(0, 0.5, 0)), 
                toPlayer
            );
            
            const intersects = raycaster.intersectObjects(this.mazeManager.meshes);
            let blocked = false;
            
            if (intersects.length > 0 && intersects[0].distance < dist) {
                blocked = true;
            }

            if (!blocked) {
                this.state = 'CHASING';
                this.lastKnownPosition.copy(pPos); // Atualiza sempre que vê
                return;
            }
        }
        
        // Se perdeu visão mas estava perseguindo, vai investigar a última posição
        if(this.state === 'CHASING') {
            this.state = 'INVESTIGATING';
        }
    }

    _move(delta) {
        const pPos = this.player.getPosition();
        let desiredDir = new THREE.Vector3();

        if (this.state === 'CHASING') {
            desiredDir.subVectors(pPos, this.position).normalize();
        } else if (this.state === 'INVESTIGATING') {
            // Vai até a última posição conhecida
            const distToTarget = this.position.distanceTo(this.lastKnownPosition);
            if(distToTarget < 1.0) {
                this.state = 'SEARCHING'; // Chegou e não viu nada, desiste
            } else {
                desiredDir.subVectors(this.lastKnownPosition, this.position).normalize();
            }
        } else {
            const noise = new THREE.Vector3(Math.random()-0.5, 0, Math.random()-0.5).multiplyScalar(2);
            desiredDir.subVectors(pPos, this.position).add(noise).normalize();
        }

        this.speedOscillator += delta * 2.0;
        const wave = Math.sin(this.speedOscillator); 
        let currentSpeed = CONFIG.ENEMY.baseSpeed + (wave + 1) * 0.5 * (CONFIG.ENEMY.chaseSpeedMax - CONFIG.ENEMY.baseSpeed);
        
        if (this.state === 'CHASING') currentSpeed += 2.0; 

        this.velocity.x = desiredDir.x * currentSpeed * delta;
        this.velocity.z = desiredDir.z * currentSpeed * delta;

        if (!this.mazeManager.checkCollision(this.position.x + this.velocity.x, this.position.z, 0.8)) {
            this.position.x += this.velocity.x;
        } else {
            this.velocity.x *= -0.5; 
        }

        if (!this.mazeManager.checkCollision(this.position.x, this.position.z + this.velocity.z, 0.8)) {
            this.position.z += this.velocity.z;
        } else {
            this.velocity.z *= -0.5;
        }
    }

    _updateSteps(delta) {
        if(!this.footstepSound || !this.footstepSound.buffer) return;

        // Só toca se estiver se movendo
        const speed = this.velocity.length();
        if(speed < 0.1) return;

        this.stepTimer += delta;
        // Passos mais rápidos se estiver correndo (CHASING)
        const interval = (this.state === 'CHASING') ? 0.3 : 0.5;

        if(this.stepTimer >= interval) {
            this.stepTimer = 0;
            if(this.footstepSound.isPlaying) this.footstepSound.stop();
            
            // Variação de pitch para soar assustador/pesado
            this.footstepSound.setPlaybackRate(0.7 + Math.random() * 0.2);
            this.footstepSound.play();
        }
    }

    stopAudio() {
        if(this.chaseSound && this.chaseSound.isPlaying) this.chaseSound.stop();
        if(this.footstepSound && this.footstepSound.isPlaying) this.footstepSound.stop();
    }
}