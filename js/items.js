import * as THREE from 'three';
import { CONFIG } from './config.js';

export class ItemManager {
    constructor(scene) {
        this.scene = scene;
        this.items = []; // {x, z, id, mesh, active}
    }

    spawnItems(mazeData, count) {
        // Limpa antigos
        this.items.forEach(i => { if(i.mesh) this.scene.remove(i.mesh); });
        this.items = [];

        let deadEnds = [];
        const size = mazeData.length;
        
        for(let x=1; x<size-1; x++) {
            for(let z=1; z<size-1; z++) {
                if(mazeData[x][z] === 0) {
                    let walls = 0;
                    if(mazeData[x+1][z]===1) walls++;
                    if(mazeData[x-1][z]===1) walls++;
                    if(mazeData[x][z+1]===1) walls++;
                    if(mazeData[x][z-1]===1) walls++;
                    if(walls === 3 && !(x===1 && z===1)) deadEnds.push({x, z});
                }
            }
        }

        deadEnds.sort(() => Math.random() - 0.5);
        
        for(let i=0; i < Math.min(count, deadEnds.length); i++) {
            this._createItem(deadEnds[i].x, deadEnds[i].z);
        }
    }

    _createItem(gx, gz) {
        const wx = gx * CONFIG.CELL_SIZE + CONFIG.CELL_SIZE/2;
        const wz = gz * CONFIG.CELL_SIZE + CONFIG.CELL_SIZE/2;
        
        const geo = new THREE.DodecahedronGeometry(0.4, 0);
        const mat = new THREE.MeshBasicMaterial({ color: CONFIG.COLORS.ITEM, wireframe: true });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.set(wx, 1.5, wz);
        
        const light = new THREE.PointLight(CONFIG.COLORS.ITEM, 2, 6);
        mesh.add(light);
        
        this.scene.add(mesh);

        this.items.push({
            x: wx, z: wz, 
            id: Math.random().toString(36),
            mesh: mesh,
            active: true
        });
    }

    animate(delta) {
        this.items.forEach(item => {
            if(item.active && item.mesh) {
                item.mesh.rotation.x += delta;
                item.mesh.rotation.y += delta;
            }
        });
    }

    checkPickup(playerX, playerZ) {
        for(let item of this.items) {
            if(!item.active) continue;
            const dist = Math.sqrt((playerX - item.x)**2 + (playerZ - item.z)**2);
            if(dist < 2.0) return item;
        }
        return null;
    }

    removeItem(id) {
        const item = this.items.find(i => i.id === id);
        if(item) {
            item.active = false;
            if(item.mesh) {
                this.scene.remove(item.mesh);
                item.mesh = null; // Limpa referência
            }
        }
    }
}