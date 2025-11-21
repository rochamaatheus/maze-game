import * as THREE from 'three';
import { CONFIG } from './config.js';

export class ParticleEmitter {
    // Recebe o mazeManager para saber onde estão as paredes
    constructor(scene, mazeManager) {
        this.scene = scene;
        this.mazeManager = mazeManager; 
        this.chunks = [];
        this.MAX_CHUNKS = 100; 
    }

    // Agora aceita 'direction' (Vetor de onde o player está olhando)
    emitWallBreak(position, color, direction) {
        const numChunks = 6 + Math.floor(Math.random() * 4); 
        const baseSize = CONFIG.CELL_SIZE / 2;
        
        const material = new THREE.MeshStandardMaterial({ 
            color: color, 
            roughness: 0.9,
            flatShading: true 
        });

        for (let i = 0; i < numChunks; i++) {
            const s = (0.2 + Math.random() * 0.3) * baseSize;
            const geo = new THREE.BoxGeometry(s, s, s);
            const chunk = new THREE.Mesh(geo, material);

            // 1. Posição Inicial: Centro da parede com pequena variação
            chunk.position.copy(position);
            chunk.position.x += (Math.random() - 0.5) * 2;
            chunk.position.y += (Math.random() - 0.5) * 2;
            chunk.position.z += (Math.random() - 0.5) * 2;

            // 2. Cálculo da Força (Física de Impacto)
            // Pega a direção do player e adiciona força
            const force = 20 + Math.random() * 15; // Força do impacto
            const spread = 0.5; // O quanto espalha para os lados

            chunk.velocity = new THREE.Vector3(
                direction.x + (Math.random() - 0.5) * spread,
                (direction.y + 0.2) + (Math.random() * 0.5), // Sempre sobe um pouco
                direction.z + (Math.random() - 0.5) * spread
            ).normalize().multiplyScalar(force);

            chunk.angularVelocity = new THREE.Vector3(
                Math.random() * 10, Math.random() * 10, Math.random() * 10
            );

            chunk.halfSize = s / 2; // Usado para colisão
            chunk.isSleeping = false;

            this.scene.add(chunk);
            this.chunks.push(chunk);
        }
        this._cleanupOldChunks();
    }

    animate(delta) {
        const gravity = 40.0;
        const groundY = 0;
        const friction = 0.6; // Perda de velocidade ao bater
        const airDrag = 0.99; // Resistência do ar

        for (let i = 0; i < this.chunks.length; i++) {
            const chunk = this.chunks[i];
            if (chunk.isSleeping) continue;

            // Aplica Gravidade e Drag
            chunk.velocity.y -= gravity * delta;
            chunk.velocity.multiplyScalar(airDrag);

            // --- COLISÃO PREDITIVA COM PAREDES (X) ---
            let nextX = chunk.position.x + chunk.velocity.x * delta;
            if (this._checkWallCollision(nextX, chunk.position.z)) {
                // Se vai bater na parede em X, inverte X (Quica)
                chunk.velocity.x *= -friction; 
            } else {
                chunk.position.x = nextX;
            }

            // --- COLISÃO PREDITIVA COM PAREDES (Z) ---
            let nextZ = chunk.position.z + chunk.velocity.z * delta;
            if (this._checkWallCollision(chunk.position.x, nextZ)) {
                // Se vai bater na parede em Z, inverte Z (Quica)
                chunk.velocity.z *= -friction;
            } else {
                chunk.position.z = nextZ;
            }

            // --- COLISÃO COM O CHÃO (Y) ---
            chunk.position.y += chunk.velocity.y * delta;
            
            if (chunk.position.y - chunk.halfSize <= groundY) {
                chunk.position.y = groundY + chunk.halfSize;
                
                // Quicar no chão
                chunk.velocity.y *= -0.4; // Perde bastante energia no chão
                
                // Atrito extra no chão
                chunk.velocity.x *= 0.8;
                chunk.velocity.z *= 0.8;
                chunk.angularVelocity.multiplyScalar(0.8);

                if (Math.abs(chunk.velocity.y) < 0.5 && Math.abs(chunk.velocity.x) < 0.2 && Math.abs(chunk.velocity.z) < 0.2) {
                    chunk.isSleeping = true;
                    chunk.velocity.set(0,0,0);
                }
            }

            // Rotação visual
            chunk.rotation.x += chunk.angularVelocity.x * delta;
            chunk.rotation.y += chunk.angularVelocity.y * delta;
            chunk.rotation.z += chunk.angularVelocity.z * delta;
        }
    }

    // Helper: Verifica se uma coordenada (x,z) cai dentro de uma parede
    _checkWallCollision(x, z) {
        const gx = Math.floor(x / CONFIG.CELL_SIZE);
        const gz = Math.floor(z / CONFIG.CELL_SIZE);
        
        // Se estiver fora do mapa, considera parede
        if (gx < 0 || gx >= this.mazeManager.size || gz < 0 || gz >= this.mazeManager.size) return true;

        // Verifica na matriz do labirinto se é 1 (Parede)
        // Nota: Como a parede destruída vira 0 instantaneamente no main.js,
        // os destroços não vão colidir com o lugar de onde saíram, o que é perfeito.
        return this.mazeManager.data[gx][gz] === 1;
    }

    _cleanupOldChunks() {
        while (this.chunks.length > this.MAX_CHUNKS) {
            const old = this.chunks.shift();
            this.scene.remove(old);
            old.geometry.dispose();
        }
    }

    reset() {
        this.chunks.forEach(chunk => {
            this.scene.remove(chunk);
            if(chunk.geometry) chunk.geometry.dispose();
            if(chunk.material) chunk.material.dispose();
        });
        this.chunks = [];
    }
}